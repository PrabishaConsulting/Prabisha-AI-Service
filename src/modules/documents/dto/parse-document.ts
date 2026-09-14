import { IsOptional, IsString } from 'class-validator';

export class ParseDocumentDto {
	@IsOptional()
	@IsString()
	prompt?: string;

	@IsOptional()
	@IsString()
	model?: string;
}
