import { TFile, TFolder, Vault, normalizePath } from 'obsidian';
import { ArchiveConfig, ArchiveMode } from './settings';

export class Archiver {
	private vault: Vault;

	constructor(vault: Vault) {
		this.vault = vault;
	}

	/**
	 * Determines which archive configuration applies to a given file path
	 */
	findArchiveConfig(filePath: string, configs: ArchiveConfig[]): ArchiveConfig | null {
		// Sort configs by root path length (longest first) to match most specific first
		const sortedConfigs = configs.sort((a, b) => b.rootPath.length - a.rootPath.length);

		for (const config of sortedConfigs) {
			if (this.isFileInRoot(filePath, config.rootPath)) {
				return config;
			}
		}

		return null;
	}

	/**
	 * Checks if a file is already in an archive folder
	 */
	isFileInArchive(filePath: string, configs: ArchiveConfig[]): boolean {
		for (const config of configs) {
			const archiveFullPath = this.getArchiveFullPath(config);
			if (filePath.startsWith(archiveFullPath + '/') || filePath === archiveFullPath) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Generates the destination path for archiving a file
	 */
	generateArchivePath(filePath: string, config: ArchiveConfig): string {
		const archiveBasePath = this.getArchiveFullPath(config);

		if (config.archiveMode === 'date-based') {
			return this.generateDateBasedPath(filePath, archiveBasePath);
		} else {
			return this.generatePathMirrorPath(filePath, config, archiveBasePath);
		}
	}

	/**
	 * Archives a file or folder to the appropriate location
	 */
	async archiveFile(file: TFile | TFolder, config: ArchiveConfig): Promise<string> {
		const destinationPath = this.generateArchivePath(file.path, config);

		// Ensure the destination directory exists
		await this.ensureDirectoryExists(destinationPath);

		// Move the file
		await this.vault.rename(file, destinationPath);

		return destinationPath;
	}

	private isFileInRoot(filePath: string, rootPath: string): boolean {
		if (!rootPath) {
			return true; // Empty root path means vault root, matches everything
		}

		const normalizedRoot = normalizePath(rootPath);
		const normalizedFile = normalizePath(filePath);

		return normalizedFile.startsWith(normalizedRoot + '/') || normalizedFile === normalizedRoot;
	}

	private getArchiveFullPath(config: ArchiveConfig): string {
		if (config.rootPath) {
			return normalizePath(`${config.rootPath}/${config.archivePath}`);
		}
		return normalizePath(config.archivePath);
	}

	private generateDateBasedPath(filePath: string, archiveBasePath: string): string {
		const now = new Date();
		const yearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
		const fileName = filePath.split('/').pop() || '';

		return normalizePath(`${archiveBasePath}/${yearMonth}/${fileName}`);
	}

	private generatePathMirrorPath(filePath: string, config: ArchiveConfig, archiveBasePath: string): string {
		let relativePath = filePath;

		// Remove the root path from the file path to get relative path
		if (config.rootPath) {
			const normalizedRoot = normalizePath(config.rootPath);
			if (filePath.startsWith(normalizedRoot + '/')) {
				relativePath = filePath.substring(normalizedRoot.length + 1);
			} else if (filePath === normalizedRoot) {
				// If archiving the root folder itself, use its name
				relativePath = normalizedRoot.split('/').pop() || '';
			}
		}

		return normalizePath(`${archiveBasePath}/${relativePath}`);
	}

	private async ensureDirectoryExists(filePath: string): Promise<void> {
		const directory = filePath.substring(0, filePath.lastIndexOf('/'));

		if (directory && !this.vault.getAbstractFileByPath(directory)) {
			// Create directory recursively
			const pathParts = directory.split('/');
			let currentPath = '';

			for (const part of pathParts) {
				currentPath = currentPath ? `${currentPath}/${part}` : part;
				const normalizedPath = normalizePath(currentPath);

				if (!this.vault.getAbstractFileByPath(normalizedPath)) {
					await this.vault.createFolder(normalizedPath);
				}
			}
		}
	}
}