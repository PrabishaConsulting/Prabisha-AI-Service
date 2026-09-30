import { IsOptional, IsString } from 'class-validator';

export class CreateEmbeddingDto {
	@IsString({ each: true })
	input: string | string[];

	@IsOptional()
	@IsString()
	model?: string;

	@IsOptional()
	@IsString()
	preferredProvider?: string;
}
