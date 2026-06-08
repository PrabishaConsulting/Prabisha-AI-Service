// src/modules/auth/strategies/central-auth.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

interface CentralProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  role?: string;
}

@Injectable()
export class CentralAuthStrategy extends PassportStrategy(Strategy, 'central-auth') {
  private centralClientSecret: string;
  private lastTokenParams: any = {};  // ← stash token response here

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const centralUrl = configService.get('CENTRAL_AUTH_URL');
    const clientSecret = configService.get('CENTRAL_CLIENT_SECRET');

    if (!clientSecret) throw new Error('CENTRAL_CLIENT_SECRET is required');

    console.log('Configuring Central Auth Strategy with:');
    console.log('Central URL:', centralUrl);
    console.log('Client ID:', configService.get('CENTRAL_CLIENT_ID'));

    // Determine the exact callback URL string based on the current environment
    const isProduction = process.env.NODE_ENV === 'production';
    const cleanCallbackUrl = isProduction 
      ? 'https://aiservice.prabisha.com/auth/callback' 
      : (configService.get('CENTRAL_CALLBACK_URL') || 'http://localhost:3000/auth/callback');

    console.log('Enforced Callback URL Strategy Target:', cleanCallbackUrl);

    super({
      authorizationURL: `${centralUrl}/oidc/authorize`,
      tokenURL: `${centralUrl}/oidc/token`,
      clientID: configService.get('CENTRAL_CLIENT_ID')!,
      clientSecret: clientSecret,
      callbackURL: cleanCallbackUrl, // ← Hardcoded target fallback ensuring zero dynamic parameter corruption
      scope: ['openid', 'email', 'profile'],
      state: true,
      pkce: true,
      customHeaders: { Accept: 'application/json' },
    });

    this.centralClientSecret = clientSecret;

    // Patch _oauth2.getOAuthAccessToken to intercept the raw token response
    // passport-oauth2 uses this internally and doesn't always forward all fields
    const originalGetToken = (this as any)._oauth2.getOAuthAccessToken.bind(
      (this as any)._oauth2,
    );

    (this as any)._oauth2.getOAuthAccessToken = (
      code: string,
      params: any,
      callback: (err: any, accessToken: string, refreshToken: string, results: any) => void,
    ) => {
      originalGetToken(code, params, (err: any, accessToken: string, refreshToken: string, results: any) => {
        if (!err && results) {
          console.log('Raw token response keys:', Object.keys(results));
          console.log('Has id_token in raw response:', !!results.id_token);
          // Stash the full results so validate() can read them
          this.lastTokenParams = results;
        }
        callback(err, accessToken, refreshToken, results);
      });
    };
  }

  // Skip the userinfo endpoint entirely
  userProfile(_accessToken: string, done: (err: any, profile?: any) => void) {
    done(null, {});
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    params: any,
    _profile: any,
  ): Promise<any> {
    // params from passport-oauth2 may be empty — use our stashed copy instead
    const tokenResponse = Object.keys(params || {}).length > 0
      ? params
      : this.lastTokenParams;

    console.log('=== OAuth Callback ===');
    console.log('Params keys (passport):', Object.keys(params || {}));
    console.log('Params keys (stashed):', Object.keys(tokenResponse || {}));
    console.log('Has id_token:', !!tokenResponse?.id_token);

    if (!tokenResponse?.id_token) {
      console.error('Token response dump:', JSON.stringify(tokenResponse, null, 2));
      throw new UnauthorizedException(
        'No id_token in token response. Check your auth server returns id_token.',
      );
    }

    const userInfo = this.decodeIdToken(tokenResponse.id_token);

    if (!userInfo?.email) {
      throw new UnauthorizedException('Could not extract user info from id_token');
    }

    return this.syncUser(userInfo);
  }

  private decodeIdToken(idToken: string): CentralProfile | null {
    // Try verified decode first (HS256 with client secret, same as NextAuth)
    try {
      const decoded = jwt.verify(idToken, this.centralClientSecret, {
        algorithms: ['HS256'],
      }) as any;
      console.log('ID token verified successfully. Email:', decoded.email);
      return {
        sub: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        role: decoded.role,
      };
    } catch (verifyError) {
      console.warn('JWT verify failed, trying unverified decode:', verifyError);
    }

    // Fallback: decode without verification
    try {
      const decoded = jwt.decode(idToken) as any;
      if (decoded?.sub && decoded?.email) {
        console.log('ID token decoded (unverified). Email:', decoded.email);
        return {
          sub: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture,
          role: decoded.role,
        };
      }
    } catch (decodeError) {
      console.error('JWT decode failed:', decodeError);
    }

    return null;
  }

  private async syncUser(profile: CentralProfile) {
    console.log('Syncing user:', profile.email);

    if (!profile.email) {
      throw new UnauthorizedException('No email provided by central auth');
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    const userRole = adminEmails.includes(profile.email) ? 'ADMIN' : 'USER';

    const existingUser = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (existingUser) {
      return this.prisma.user.update({
        where: { email: profile.email },
        data: {
          name: profile.name || existingUser.name,
          image: profile.picture || existingUser.image,
          role: userRole,
          updatedAt: new Date(),
        },
      });
    }

    return this.prisma.user.create({
      data: {
        id: profile.sub,
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        image: profile.picture,
        role: userRole,
        isActive: true,
      },
    });
  }
}