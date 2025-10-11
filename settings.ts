export type ArchiveMode = 'date-based' | 'path-mirror';

export type LinkUpdateMode = 'always' | 'ask' | 'never';

export interface ArchiveConfig {
	id: string;
	name: string;
	rootPath: string;
	archivePath: string;
	archiveMode: ArchiveMode;
}

export interface ArchiveOperation {
	originalPath: string;
	destinationPath: string;
	linkUpdates: import('./link-updater').LinkUpdate[];
	timestamp: number;
	config: ArchiveConfig;
}

export interface PARAArchiveSettings {
	archiveConfigs: ArchiveConfig[];
	showConfirmation: boolean;
	linkUpdateMode: LinkUpdateMode;
	showUndoNotice: boolean;
	undoTimeoutMs: number;
}

export const DEFAULT_SETTINGS: PARAArchiveSettings = {
	archiveConfigs: [
		{
			id: 'default',
			name: 'Default',
			rootPath: '',
			archivePath: 'Archive',
			archiveMode: 'path-mirror'
		}
	],
	showConfirmation: true,
	linkUpdateMode: 'always',
	showUndoNotice: true,
	undoTimeoutMs: 5000
};