export type ArchiveMode = 'date-based' | 'path-mirror';

export type LinkUpdateMode = 'always' | 'ask' | 'never';

export interface ArchiveConfig {
	id: string;
	name: string;
	rootPath: string;
	archivePath: string;
	archiveMode: ArchiveMode;
}

export interface PARAArchiveSettings {
	archiveConfigs: ArchiveConfig[];
	showConfirmation: boolean;
	linkUpdateMode: LinkUpdateMode;
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
	linkUpdateMode: 'always'
};