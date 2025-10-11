import { TFile, TFolder, Vault, normalizePath } from 'obsidian';
import { ArchiveConfig, ArchiveMode, ArchiveOperation } from './settings';

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

		// Check if destination already exists
		const existingItem = this.vault.getAbstractFileByPath(destinationPath);

		if (file instanceof TFolder && existingItem instanceof TFolder) {
			// Folder conflict: merge contents instead of renaming
			await this.mergeFolderContents(file, existingItem);
			// Remove the original folder after moving its contents
			await this.vault.delete(file);
		} else {
			// Ensure the destination directory exists
			await this.ensureDirectoryExists(destinationPath);
			// Move the file/folder normally
			await this.vault.rename(file, destinationPath);
		}

		return destinationPath;
	}

	/**
	 * Undoes an archive operation by moving the file/folder back to its original location
	 */
	async undoArchive(operation: ArchiveOperation): Promise<void> {
		// Check if the archived file still exists
		const archivedFile = this.vault.getAbstractFileByPath(operation.destinationPath);
		if (!archivedFile) {
			throw new Error('Archived file no longer exists and cannot be restored');
		}

		// Check if original location is now occupied
		const existingFile = this.vault.getAbstractFileByPath(operation.originalPath);
		if (existingFile) {
			// Generate a unique name for the restore
			const uniquePath = await this.generateUniquePath(operation.originalPath);
			await this.vault.rename(archivedFile, uniquePath);
			throw new Error(`Original location is occupied. File restored to: ${uniquePath}`);
		}

		// Ensure the original directory exists
		await this.ensureDirectoryExists(operation.originalPath);

		// Move the file back to its original location
		await this.vault.rename(archivedFile, operation.originalPath);
	}

	/**
	 * Merges contents of source folder into destination folder
	 */
	private async mergeFolderContents(sourceFolder: TFolder, destinationFolder: TFolder): Promise<void> {
		// Get all children of the source folder
		for (const child of sourceFolder.children) {
			const childDestinationPath = normalizePath(`${destinationFolder.path}/${child.name}`);

			try {
				// Check if destination already has an item with the same name
				const existingChild = this.vault.getAbstractFileByPath(childDestinationPath);

				if (child instanceof TFolder && existingChild instanceof TFolder) {
					// Recursive merge for nested folders
					await this.mergeFolderContents(child, existingChild);
					await this.vault.delete(child);
				} else if (existingChild) {
					// Handle file conflicts - could add user choice here in the future
					// For now, we'll create a unique name
					const uniquePath = await this.generateUniquePath(childDestinationPath);
					await this.vault.rename(child, uniquePath);
				} else {
					// No conflict, move normally
					await this.vault.rename(child, childDestinationPath);
				}
			} catch (error) {
				console.error(`Failed to move ${child.path} to ${childDestinationPath}:`, error);
				throw error;
			}
		}
	}

	/**
	 * Generates a unique path by adding numbers if needed
	 */
	private async generateUniquePath(basePath: string): Promise<string> {
		let counter = 1;
		let newPath = basePath;

		while (this.vault.getAbstractFileByPath(newPath)) {
			const pathParts = basePath.split('.');
			if (pathParts.length > 1) {
				// Has extension
				const extension = pathParts.pop();
				const nameWithoutExt = pathParts.join('.');
				newPath = `${nameWithoutExt} ${counter}.${extension}`;
			} else {
				// No extension (folder or file without extension)
				newPath = `${basePath} ${counter}`;
			}
			counter++;
		}

		return newPath;
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
		// If archive path is absolute or already includes the root path, use it as-is
		if (!config.rootPath || config.archivePath.startsWith(config.rootPath)) {
			return normalizePath(config.archivePath);
		}
		// Otherwise, treat archive path as relative to root path
		return normalizePath(`${config.rootPath}/${config.archivePath}`);
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