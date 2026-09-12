import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import './style.css';
import { AuthGate } from '../../components/AuthGate/AuthGate.tsx';
import Notifications from '../../components/Notifications/Notifications.tsx';
import { AuthProvider } from '../../context/AuthContext.tsx';
import { useHeartBeatProtected } from '../../hooks/useHeartBeat.ts';

const root = document.getElementById('root') as HTMLDivElement;

createRoot(root).render(
	(
		<StrictMode>
			<AuthProvider>
				<AuthGate hook={useHeartBeatProtected}>
					<Notifications />
				</AuthGate>
			</AuthProvider>
		</StrictMode>
	)
);
