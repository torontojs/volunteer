import { env } from 'cloudflare:workers';

import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import packageJson from '../../package.json' with { type: 'json' };
import { authRoutes } from './routes/auth/index.ts';
import { documentRoutes } from './routes/documents/index.ts';
import { fileRoutes } from './routes/files/index.ts';
import { healthCheckRoutes } from './routes/health-check/index.ts';
import { profileRoutes } from './routes/profile/index.ts';
import { teamMemberRoutes } from './routes/team-members/index.ts';
import { teamRoutes } from './routes/team/index.ts';
import { cronHandler } from './scheduler/index.ts';
import { StatusCodes, statusResponseFormatter } from './utils/responses.ts';

export const app = new OpenAPIHono<EnvironmentBindings>({
	defaultHook: statusResponseFormatter
});

const apiRoutes = new OpenAPIHono<EnvironmentBindings>({
	defaultHook: statusResponseFormatter
});

// Browser hardening, applied to every Worker response (API + assets).
app.use(
	'/*',
	secureHeaders({
		contentSecurityPolicy: {
			defaultSrc: ["'self'"],
			baseUri: ["'self'"],
			frameAncestors: ["'none'"],
			objectSrc: ["'none'"]
		},
		permissionsPolicy: {
			camera: [],
			geolocation: [],
			microphone: []
		},
		referrerPolicy: 'no-referrer',
		xFrameOptions: 'DENY'
	})
);

// Catch all error handler.
apiRoutes.onError((err, context) => {
	console.error(err);

	return context.json({ message: 'An error has occured' }, StatusCodes.INTERNAL_SERVER_ERROR);
});

// CORS middleware
apiRoutes.use(
	'/*',
	cors({
		origin: [env.BASE_URL, env.FRONTEND_URL],
		credentials: true,
		allowMethods: ['POST', 'GET', 'OPTIONS', 'DELETE', 'PATCH'],
		allowHeaders: ['Content-Type']
	})
);

apiRoutes.doc('/open-api.json', {
	openapi: '3.0.0',
	servers: [
		{
			url: 'https://vms.torontojs.com/',
			description: 'Production server.'
		},
		{
			url: 'http://localhost:4242/',
			description: 'Local server for development.'
		}
	],
	info: {
		title: 'Toronto JS Community Hub API',
		version: packageJson.version,
		description: `
		This is the API documentation for the [Toronto JS Community Hub](https://vms.torontojs.com/).

		Please note that the recomended way of getting data from the community hub is to use the staticly generated data available on GitHub.
		`
	}
});

apiRoutes.get('/docs', swaggerUI({ url: '/api/open-api.json' }));

// Handle static assets using Cloudflare Workers
apiRoutes.get('/assets/*', async (context) => context.env.Assets.fetch(context.req.raw));

apiRoutes.route('/', healthCheckRoutes);
apiRoutes.route('/auth', authRoutes);
apiRoutes.route('/profiles', profileRoutes);
apiRoutes.route('/documents', documentRoutes);
apiRoutes.route('/teams', teamRoutes);
// All routes follow the format /teams/{id}/members
apiRoutes.route('/teams', teamMemberRoutes);
apiRoutes.route('/files', fileRoutes);

// Make all routes prefixed to /api
app.route('/api', apiRoutes);

export default {
	fetch: app.fetch,
	scheduled: cronHandler(app)
};
