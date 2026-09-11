import { z } from 'zod';

export const AllowedFileMimeTypesOptions = ['image/png', 'image/jpeg'] as const;

export const AllowedFileMimeTypeSchema = z.enum(AllowedFileMimeTypesOptions).describe('The allowed MIME types for the uploaded documents.');

export type AllowedFileMimeType = z.infer<typeof AllowedFileMimeTypeSchema>;

export const mimeToExtensionsMap: Record<AllowedFileMimeType, string[]> = {
	'image/jpeg': ['jpg', 'jpeg'],
	'image/png': ['png']
};

export const PublicFileTypes = ['avatars'] as const;

export const AllFileTypes = [...PublicFileTypes] as const;

export const FileTypeSchema = z.enum(AllFileTypes).describe('The purpose of the uploaded image. E.g., user avatars or other document.');

export type UploadedFileType = z.infer<typeof FileTypeSchema>;

export const FileUploadSchema = z.object({
	file: z
		.custom<File>((file) => file instanceof File, {
			message: 'Uploaded value is not a File'
		})
		.refine(
			(file) => AllowedFileMimeTypesOptions.includes(file.type as AllowedFileMimeType),
			{ message: 'Invalid image file type. Only JPEG and PNG are allowed!' }
		)
		.describe('The allowed MIME types for file uploads to the platform for storage in R2 bucket.'),
	type: FileTypeSchema
});

export const validateFileExtension = (fileName: string, mimeType: string): boolean => {
	const lastDotIndex = fileName.lastIndexOf('.');
	const lastSlashIndex = Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\'));

	// No extension or extension is at the end (e.g., "file.")
	if (lastDotIndex <= lastSlashIndex || lastDotIndex === fileName.length - 1) {
		return false;
	}

	const extension = fileName.slice(lastDotIndex + 1).toLowerCase();

	if (!AllowedFileMimeTypesOptions.includes(mimeType as AllowedFileMimeType)) {
		return false;
	}

	const validExtensions = mimeToExtensionsMap[mimeType as AllowedFileMimeType];
	return validExtensions?.includes(extension) ?? false;
};
