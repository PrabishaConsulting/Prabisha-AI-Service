// src/modules/admin/admin.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Render, Req, Res, Query } from '@nestjs/common';
import { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import * as crypto from 'crypto';
import { ApiKeyScope } from 'src/generated/prisma/enums';

interface RequestWithUser extends Request {
  user: { id: string; email: string; role: string };
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  @Render('dashboard')
  async dashboard(@Req() req: RequestWithUser) {
    const [stats, recentActivity, dailyUsage, providerDist] = await Promise.all([
      this.adminService.getDashboardStats((req as any).user.id),
      this.adminService.getRecentActivity(),
      this.adminService.getDailyUsage(7),
      this.adminService.getProviderDistribution(),
    ]);

    return {
      title: 'Dashboard - AI Gateway Admin',
      pageTitle: 'Dashboard',
      pageSubtitle: 'Overview of your AI Gateway',
      user: (req as any).user,
      layout: 'layouts/main',
      active: { dashboard: true },
      stats,
      recentActivity,
      usageLabels: JSON.stringify(dailyUsage.labels),
      usageData: JSON.stringify(dailyUsage.data),
      providerLabels: JSON.stringify(providerDist.labels),
      providerData: JSON.stringify(providerDist.data),
    };
  }

  @Get('providers')
  @Render('admin/providers')
  async providers(@Req() req: RequestWithUser) {
    const providers = await this.adminService.getAllProviders();
    
    return {
      title: 'AI Providers - AI Gateway Admin',
      pageTitle: 'AI Providers',
      pageSubtitle: 'Manage AI provider configurations',
      user: (req as any).user,
      layout: 'layouts/main',
      active: { providers: true },
      providers,
    };
  }

  @Get('providers/:id')
  @Render('admin/provider-details')
  async providerDetails(@Req() req: RequestWithUser, @Param('id') id: string) {
    const provider = await this.adminService.getProvider(id);
    
    if (!provider) {
      return { layout: 'layouts/main', title: 'Provider Not Found' };
    }
    
    const defaultModel = provider.models.find(m => m.isDefault);
    const maxContextModel = provider.models.length > 0 
      ? provider.models.reduce((prev, current) => ((prev.contextWindow || 0) > (current.contextWindow || 0) ? prev : current))
      : null;

    return {
      title: `${provider.displayName} Models - AI Gateway`,
      pageTitle: provider.displayName,
      pageSubtitle: 'Manage models, pricing, and context windows',
      user: (req as any).user,
      layout: 'layouts/main',
      active: { providers: true },
      provider,
      stats: {
        totalModels: provider.models.length,
        defaultModel: defaultModel ? defaultModel.displayName : 'None Assigned',
        maxContext: maxContextModel && maxContextModel.contextWindow ? maxContextModel.contextWindow : 'N/A'
      }
    };
  }

  @Post('api/providers')
  async createProvider(@Body() data: any) {
    return this.adminService.createProvider(data);
  }

  @Put('api/providers/:id')
  async updateProvider(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.adminService.updateProvider(id, data);
  }

  @Delete('api/providers/:id')
  async deleteProvider(@Param('id') id: string) {
    return this.adminService.deleteProvider(id);
  }

  @Get('api/providers/:id')
  async getProvider(@Param('id') id: string) {
    return this.adminService.getProvider(id);
  }

  @Get('api-keys')
  @Render('api-keys')
  async apiKeys(@Req() req: RequestWithUser) {
    const [apiKeys, stats] = await Promise.all([
      this.adminService.getUserApiKeys((req as any).user.id),
      this.adminService.getApiKeyStats(),
    ]);
    
    return {
      title: 'API Keys - AI Gateway Admin',
      pageTitle: 'API Keys',
      pageSubtitle: 'Manage user API keys',
      user: (req as any).user,
      layout: 'layouts/main',
      active: { apiKeys: true },
      apiKeys: apiKeys || [],
      stats,
    };
  }

  @Get('analytics')
  @Render('analytics')
  async analytics(@Req() req: RequestWithUser) {
    return {
      title: 'Analytics - AI Gateway Admin',
      pageTitle: 'Analytics',
      pageSubtitle: 'Usage statistics and insights',
      user: (req as any).user,
      layout: 'layouts/main',
      active: { analytics: true },
    };
  }

  @Get('usage-logs')
  @Render('admin/usage-logs')
  async usageLogs(@Req() req: RequestWithUser, @Query() query: any) {
    const result = await this.adminService.getUsageLogs({
      modality: query.modality,
      providerId: query.providerId,
      status: query.status,
      from: query.from,
      to: query.to,
      page: Number(query.page) || 1,
    });
    const providers = await this.adminService.getAllProviders();

    return {
      title: 'Usage Logs - AI Gateway Admin',
      pageTitle: 'Usage Logs',
      pageSubtitle: 'Inspect requests, latency, tokens, and estimated cost',
      user: (req as any).user,
      layout: 'layouts/main',
      active: { usageLogs: true },
      activeUsageLogs: true,
      ...result,
      providers,
      filters: query,
    };
  }

  @Get('users')
  @Render('admin/users')
  async users(@Req() req: RequestWithUser) {
    const users = await this.adminService.getUsers();
    
    return {
      title: 'Users - AI Gateway Admin',
      pageTitle: 'Users',
      pageSubtitle: 'Manage platform users',
      user: (req as any).user,
      layout: 'layouts/main',
      active: { users: true },
      users,
    };
  }

  // API Endpoints for AJAX calls
  @Post('api/providers/:id/status')
  async updateProviderStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.adminService.updateProviderStatus(id, status as any);
  }

  @Put('api/providers/:id/key')
  async updateProviderApiKey(
    @Param('id') id: string,
    @Body('apiKey') apiKey: string,
  ) {
    if (!apiKey || apiKey.trim() === '') {
      return { success: false, message: 'API key is required' };
    }
    
    // Encrypt the API key before storing
    const encryptionResult = await this.adminService.encryptApiKey(apiKey);
    
    return this.adminService.updateProviderApiKey(
      id,
      encryptionResult.encryptedKey,
      encryptionResult.iv,
      encryptionResult.authTag,
    );
  }

  @Post('api/providers/:id/test')
  async testProviderConnection(
    @Param('id') id: string,
    @Body('apiKey') apiKey?: string,
  ) {
    return this.adminService.testProviderConnection(id, apiKey);
  }

  @Get('api/keys/:id')
  async getApiKey(@Param('id') id: string) {
    return this.adminService.getApiKey(id);
  }

  @Put('api/keys/:id')
  async updateApiKey(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.adminService.updateApiKey(id, data);
  }

  @Post('api/keys')
  async createApiKey(
    @Req() req: RequestWithUser,
    @Body('name') name: string,
    @Body('scopes') scopes: string[],
    @Body('expiresAt') expiresAt?: Date,
    @Body('rpmLimit') rpmLimit?: number,
    @Body('rpdLimit') rpdLimit?: number,
    @Body('monthlyTokenLimit') monthlyTokenLimit?: number,
  ) {
    const userId = (req as any).user?.id;
    return this.adminService.createApiKey(
      userId,
      name,
      scopes as ApiKeyScope[],
      { expiresAt, rpmLimit, rpdLimit, monthlyTokenLimit }
    );
  }

  @Delete('api/keys/:id')
  async revokeApiKey(@Param('id') id: string) {
    return this.adminService.revokeApiKey(id);
  }

  @Delete('api/keys/:id/permanent')
  async permanentlyDeleteApiKey(@Param('id') id: string) {
    return this.adminService.permanentlyDeleteApiKey(id);
  }

  @Get('api/analytics/stats')
  async getAnalyticsStats() {
    const dailyUsage = await this.adminService.getDailyUsage(30);
    const providerDist = await this.adminService.getProviderDistribution();
    const topUsers = await this.adminService.getTopUsers();
    
    return {
      dailyLabels: dailyUsage.labels,
      dailyCounts: dailyUsage.data,
      providerLabels: providerDist.labels,
      providerCounts: providerDist.data,
      topUsers
    };
  }
}