import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import ProfileList from '../../components/Profile.js';

import './style.css';

createRoot(document.getElementById('root')!).render(
	(
		<StrictMode>
			<div className='App'>
				<ProfileList />
			</div>
		</StrictMode>
	)
);
