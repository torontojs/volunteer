import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth.ts';
import { fileUploadSizeCheck } from '../../middleware/body-size.ts';
import { getSession } from '../../utils/auth.ts';
import { StatusCodes, type StatusResponse, statusResponseFormatter, StatusResponseSchema } from '../../utils/responses.ts';
import { getProfileById } from '../profile/data.ts';
import { updateAvatar } from './data.ts';
import {
	type AllowedFileMimeType,
	FileUploadSchema,
	type UploadedFileType,
	validateFileExtension
} from './validation.ts';

export const fileRoutes = new OpenAPIHono<EnvironmentBindings>({
	defaultHook: statusResponseFormatter
});

// NOTE: Add more specific GET routes before the following route only
fileRoutes.openapi(
	createRoute({
		method: 'get',
		path: '/*',
		operationId: 'Get File',
		summary: 'Get a file from Cloudflare R2',
		description: 'Get a file from Cloudflare R2 using the filename.',
		tags: ['File'],
		responses: {
			[StatusCodes.OKAY]: {
				description: 'Successful response',
				content: {
					'image/*': {
						schema: { type: 'string', format: 'binary' }
					}
				}
			},
			[StatusCodes.BAD_REQUEST]: {
				description: 'Invalid or missing data',
				content: { 'application/json': { schema: StatusResponseSchema } }
			},
			[StatusCodes.NOT_FOUND]: {
				description: 'Invalid file name or missing file',
				content: { 'application/json': { schema: StatusResponseSchema } }
			},
			[StatusCodes.INTERNAL_SERVER_ERROR]: {
				description: 'Server Error response',
				content: { 'application/json': { schema: StatusResponseSchema } }
			}
		}
	}),
	async (context) => {
		try {
			const filePrefix = context.req.path.replace('/api/files/', '');
			const r2Bucket = context.env.ExportedFiles;
			const file = await r2Bucket.get(filePrefix);

			if (file) {
				const contentType = file.httpMetadata?.contentType ?? 'bin';

				return context.body(file.body, {
					headers: {
						'Content-Type': contentType,
						'Content-Disposition': `inline; filename="${filePrefix.split('/').pop()}"`
					}
				});
			}

			return context.json(
				{ message: `File was not found.` },
				StatusCodes.NOT_FOUND
			);
		} catch (err) {
			console.error('File retrieval failed:', err);
			return context.json(
				{ message: 'Error fetching the file' },
				StatusCodes.INTERNAL_SERVER_ERROR
			);
		}
	}
);

fileRoutes.openapi(
	createRoute({
		method: 'post',
		path: '/upload',
		operationId: 'Upload File',
		summary: 'Upload a file to Cloudflare R2',
		description: 'Upload a file received via multipart/form-data to Cloudflare R2.',
		tags: ['File'],
		request: {
			body: { content: { 'multipart/form-data': { schema: FileUploadSchema } }, required: true }
		},
		responses: {
			[StatusCodes.OKAY]: {
				description: 'Successful response',
				content: { 'application/json': { schema: StatusResponseSchema } }
			},
			[StatusCodes.BAD_REQUEST]: {
				description: 'Invalid file or missing data',
				content: { 'application/json': { schema: StatusResponseSchema } }
			},
			[StatusCodes.INTERNAL_SERVER_ERROR]: {
				description: 'Server Error response',
				content: { 'application/json': { schema: StatusResponseSchema } }
			},
			[StatusCodes.NOT_FOUND]: {
				description: 'Internal error getting profile that should exist',
				content: { 'application/json': { schema: StatusResponseSchema } }
			}
		},
		middleware: [authMiddleware, fileUploadSizeCheck] as const
	}),
	async (context) => {
		const sessionData = getSession(context);
		const profile = await getProfileById(context.env.Database, sessionData.id);

		if (!profile || profile.id !== sessionData.id) {
			return context.json({ message: 'Upload failed!' } satisfies StatusResponse, StatusCodes.NOT_FOUND);
		}

		const formData = await context.req.formData();
		const file = formData.get('file') as File;
		const fileType = formData.get('type') as UploadedFileType;

		if (!file || !(file instanceof File)) {
			return context.json({ message: 'No or invalid file uploaded. Please provide a file!' } satisfies StatusResponse, StatusCodes.BAD_REQUEST);
		}

		const fileMimeType = file.type as AllowedFileMimeType;

		if (!validateFileExtension(file.name, fileMimeType)) {
			return context.json({ message: 'Invalid image file extension. Only JPEG and PNG are allowed!' } satisfies StatusResponse, StatusCodes.BAD_REQUEST);
		}

		const fileExtension = file.name?.split('.').pop() ?? 'bin';
		const fileId = crypto.randomUUID();
		// fileNameWithPrefix: The filename with prefix to be uploaded to R2 storage
		// Example: "avatars/5eda5bee-3f48-4ad8-8ccc-e06b5e134da4.jpg"
		const fileNameWithPrefix = `${fileType}/${fileId}.${fileExtension}`;
		// fileUrl: Full URL stored in database to access the file
		// Example: "/api/files/avatars/5eda5bee-3f48-4ad8-8ccc-e06b5e134da4.jpg"
		const fileUrl = `/api/files/${fileNameWithPrefix}`;
		const stream = file.stream();

		try {
			// TODO: Determine if we need to create thumbnails
			const r2Bucket = context.env.ExportedFiles;
			const r2UploadResult = await r2Bucket.put(fileNameWithPrefix, stream);

			if (r2UploadResult?.key === fileNameWithPrefix && fileType === 'avatars') {
				const isSuccessful = await updateAvatar(context.env.Database, profile.id, fileUrl);

				const previousFileNameInR2 = profile.avatar?.replace('/api/files/', '');
				if (isSuccessful) {
					// Delete previous avatar file from r2 if it exists
					if (previousFileNameInR2) {
						await r2Bucket.delete(previousFileNameInR2);
					}
					return context.json({ message: 'File uploaded successfully!' } satisfies StatusResponse, StatusCodes.OKAY);
				}
				// Clean up orphaned file if upload fails
				await r2Bucket.delete(fileNameWithPrefix);
			}

			return context.json({ message: 'Upload failed!' }, StatusCodes.INTERNAL_SERVER_ERROR);
		} catch (err) {
			console.error('Upload failed:', err);
			return context.json(
				{ message: 'Upload failed!' },
				StatusCodes.INTERNAL_SERVER_ERROR
			);
		}
	}
);
