import { App, TFile, MetadataCache, Vault } from 'obsidian';

export interface LinkUpdate {
	file: TFile;
	oldContent: string;
	newContent: string;
	linkCount: number;
}

export class LinkUpdater {
	private app: App;
	private vault: Vault;
	private metadataCache: MetadataCache;

	constructor(app: App) {
		this.app = app;
		this.vault = app.vault;
		this.metadataCache = app.metadataCache;
	}

	/**
	 * Finds all files that link to the given file
	 */
	findLinksToFile(targetFile: TFile): TFile[] {
		const linkedFiles: TFile[] = [];
		const allFiles = this.vault.getMarkdownFiles();

		for (const file of allFiles) {
			const cache = this.metadataCache.getFileCache(file);
			if (!cache) continue;

			// Check links
			if (cache.links) {
				for (const link of cache.links) {
					const linkedFile = this.metadataCache.getFirstLinkpathDest(link.link, file.path);
					if (linkedFile && linkedFile.path === targetFile.path) {
						linkedFiles.push(file);
						break;
					}
				}
			}

			// Check embeds
			if (cache.embeds) {
				for (const embed of cache.embeds) {
					const linkedFile = this.metadataCache.getFirstLinkpathDest(embed.link, file.path);
					if (linkedFile && linkedFile.path === targetFile.path) {
						if (linkedFiles.indexOf(file) === -1) {
							linkedFiles.push(file);
						}
						break;
					}
				}
			}
		}

		return linkedFiles;
	}

	/**
	 * Prepares link updates for all files that reference files within a moved folder
	 */
	async prepareFolderLinkUpdates(oldFolderPath: string, newFolderPath: string): Promise<LinkUpdate[]> {
		const updates: LinkUpdate[] = [];
		const allFiles = this.vault.getMarkdownFiles();

		// Get all files that were in the folder
		const filesInFolder = this.vault.getMarkdownFiles().filter(file =>
			file.path.startsWith(oldFolderPath + '/') || file.path === oldFolderPath
		);

		// For each file that was in the folder, find and update links to it
		for (const fileInFolder of filesInFolder) {
			// Calculate what the new path would be for this file
			const relativePath = fileInFolder.path.substring(oldFolderPath.length);
			const newFilePath = newFolderPath + relativePath;

			// Find all files that link to this file and prepare updates
			const fileUpdates = await this.prepareLinkUpdates(fileInFolder.path, newFilePath);
			updates.push(...fileUpdates);
		}

		return updates;
	}

	/**
	 * Prepares link updates for all files that reference the moved file
	 */
	async prepareLinkUpdates(oldPath: string, newPath: string): Promise<LinkUpdate[]> {
		const updates: LinkUpdate[] = [];
		const allFiles = this.vault.getMarkdownFiles();

		for (const file of allFiles) {
			const content = await this.vault.read(file);
			const newContent = this.updateLinksInContent(content, oldPath, newPath, file.path);

			if (content !== newContent) {
				const linkCount = this.countUpdatedLinks(content, newContent);
				updates.push({
					file,
					oldContent: content,
					newContent,
					linkCount
				});
			}
		}

		return updates;
	}

	/**
	 * Applies all prepared link updates
	 */
	async applyLinkUpdates(updates: LinkUpdate[]): Promise<{ success: number; failed: string[] }> {
		let success = 0;
		const failed: string[] = [];

		for (const update of updates) {
			try {
				await this.vault.modify(update.file, update.newContent);
				success++;
			} catch (error) {
				failed.push(update.file.path);
				console.error(`Failed to update links in ${update.file.path}:`, error);
			}
		}

		return { success, failed };
	}

	/**
	 * Updates all links in content that point to the old path
	 */
	private updateLinksInContent(content: string, oldPath: string, newPath: string, currentFilePath: string): string {
		let updatedContent = content;

		// Get the file name without extension for matching
		const oldFileName = oldPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || '';
		const newRelativePath = this.getRelativePath(currentFilePath, newPath);

		// Update wikilinks
		updatedContent = this.updateWikilinks(updatedContent, oldPath, newPath, oldFileName, newRelativePath, currentFilePath);

		// Update markdown links
		updatedContent = this.updateMarkdownLinks(updatedContent, oldPath, newPath, currentFilePath);

		return updatedContent;
	}

	private updateWikilinks(content: string, oldPath: string, newPath: string, oldFileName: string, newRelativePath: string, currentFilePath: string): string {
		// Regex to match wikilinks: [[link|alias]] or [[link#header]] or [[link^block]] or [[link]]
		const wikilinkRegex = /\[\[([^\]|#^]+)([#^][^\]|]*)?\|?([^\]]*)?\]\]/g;

		return content.replace(wikilinkRegex, (match, linkPath, anchor, alias) => {
			const resolvedFile = this.metadataCache.getFirstLinkpathDest(linkPath.trim(), currentFilePath);

			// Check if this link points to our moved file
			if (resolvedFile && resolvedFile.path === oldPath) {
				const anchorPart = anchor || '';

				// Get the new filename without extension
				const newFileName = newPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || '';

				// Check if we can use just the filename (if it's unique in the vault)
				let newLinkPath: string;

				// Check if we can use the simple filename (if it's unique)
				if (this.isFilenameUnique(newFileName)) {
					// Use simple filename if it's unique in the vault
					newLinkPath = newFileName;
				} else {
					// Use relative path without extension for wikilinks
					newLinkPath = newRelativePath.replace(/\.[^/.]+$/, '');
				}

				// Handle alias preservation
				let aliasPart = '';
				if (alias) {
					// Explicit alias exists, preserve it
					aliasPart = `|${alias}`;
				} else if (newLinkPath !== newFileName && newLinkPath.includes('/')) {
					// We're using a full path but the filename is what should be displayed
					// Add an alias to preserve the clean display text
					aliasPart = `|${newFileName}`;
				}
				// If newLinkPath equals newFileName, no alias needed

				return `[[${newLinkPath}${anchorPart}${aliasPart}]]`;
			}

			return match;
		});
	}

	private updateMarkdownLinks(content: string, oldPath: string, newPath: string, currentFilePath: string): string {
		// Regex to match markdown links: [text](path) or ![alt](path)
		const markdownLinkRegex = /(!?)\[([^\]]*)\]\(([^)]+)\)/g;

		return content.replace(markdownLinkRegex, (match, isEmbed, text, linkPath) => {
			// Resolve the link to see if it points to our moved file
			const resolvedFile = this.metadataCache.getFirstLinkpathDest(linkPath.trim(), currentFilePath);

			if (resolvedFile && resolvedFile.path === oldPath) {
				const newRelativePath = this.getRelativePath(currentFilePath, newPath);
				return `${isEmbed}[${text}](${newRelativePath})`;
			}

			return match;
		});
	}

	private getRelativePath(fromPath: string, toPath: string): string {
		// Simple relative path calculation
		const fromParts = fromPath.split('/');
		const toParts = toPath.split('/');

		// Remove filename from fromPath
		fromParts.pop();

		// Find common path
		let commonLength = 0;
		for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
			if (fromParts[i] === toParts[i]) {
				commonLength++;
			} else {
				break;
			}
		}

		// Calculate relative path
		const upDirs = fromParts.length - commonLength;
		const relativeParts = [];

		// Add ../ for each directory we need to go up
		for (let i = 0; i < upDirs; i++) {
			relativeParts.push('..');
		}

		// Add the remaining path to the target
		relativeParts.push(...toParts.slice(commonLength));

		return relativeParts.join('/');
	}

	private countUpdatedLinks(oldContent: string, newContent: string): number {
		if (oldContent === newContent) {
			return 0;
		}

		// Count actual link changes by comparing line by line
		const oldLines = oldContent.split('\n');
		const newLines = newContent.split('\n');
		let linkChanges = 0;

		for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
			const oldLine = oldLines[i] || '';
			const newLine = newLines[i] || '';

			if (oldLine !== newLine) {
				// Count links in this changed line
				const linksInLine = (newLine.match(/\[\[.*?\]\]|\[.*?\]\(.*?\)/g) || []).length;
				linkChanges += linksInLine;
			}
		}

		return linkChanges;
	}

	/**
	 * Check if a filename is unique in the vault (no naming conflicts)
	 */
	private isFilenameUnique(filename: string): boolean {
		const allFiles = this.vault.getMarkdownFiles();
		const matchingFiles = allFiles.filter(file => {
			const fileBasename = file.basename;
			return fileBasename === filename;
		});

		return matchingFiles.length <= 1;
	}
}