import { IsBase64, IsOptional, IsString } from 'class-validator';

export class ParseDocumentDto {
	@IsString()
	@IsBase64()
	base64Data: string;

	@IsString()
	mimeType: string;

	@IsOptional()
	@IsString()
	prompt?: string;

	@IsOptional()
	@IsString()
	model?: string;
}
