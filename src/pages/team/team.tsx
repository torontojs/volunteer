import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import Teams from '../../components/Teams/Teams.js';

import 'open-props';
import './style.css';

const root = document.getElementById('root') as HTMLDivElement;

createRoot(root).render(
	(
		<StrictMode>
			<div className='App'>
				<Teams />
			</div>
		</StrictMode>
	)
);
