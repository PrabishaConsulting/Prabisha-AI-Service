import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateImageDto {
	@IsString()
	prompt: string;

	@IsOptional()
	@IsString()
	model?: string;

	@IsOptional()
	@IsString()
	preferredProvider?: string;

	@IsOptional()
	@IsIn(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'])
	size?: string;

	@IsOptional()
	@IsIn(['standard', 'hd'])
	quality?: string;

	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(10)
	n?: number;
}
