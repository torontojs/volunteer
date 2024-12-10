/* eslint-env node */
/* eslint-disable camelcase */

import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type UserConfig } from 'vite';

const IS_DEBUG = false;

export default defineConfig(({ mode }) => {
	let baseUrl = 'https://sdrlog.madcampos.dev/';

	if (mode !== 'production' || IS_DEBUG) {
		baseUrl = 'https://localhost:3000/';
	}

	const config: UserConfig = {
		plugins: [react()],
		esbuild: { target: 'esnext' },
		base: baseUrl,
		envPrefix: 'APP_',
		envDir: '../',
		root: 'src',
		publicDir: '../public',
		clearScreen: false,
		server: {
			host: 'localhost',
			open: false,
			cors: true,
			port: 3000
		},
		build: {
			target: 'esnext',
			emptyOutDir: true,
			outDir: '../dist',
			rollupOptions: {
				input: {
					index: fileURLToPath(new URL('./src/index.html', import.meta.url)),
					profile: fileURLToPath(new URL('./src/pages/profile/index.html', import.meta.url)),
					team: fileURLToPath(new URL('./src/pages/team/index.html', import.meta.url))
				}
			}
		},
		optimizeDeps: { esbuildOptions: { target: 'esnext' } },
		preview: {
			open: true,
			cors: true
		}
	};

	return config;
});
