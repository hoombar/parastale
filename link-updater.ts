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
	async findLinksToFile(targetFile: TFile): Promise<TFile[]> {
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
						if (!linkedFiles.includes(file)) {
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
				// Use relative path without extension for wikilinks
				const newLinkPath = newRelativePath.replace(/\.[^/.]+$/, '');
				const anchorPart = anchor || '';
				const aliasPart = alias ? `|${alias}` : '';

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
		// Simple approach: count the number of [[ or ]( that changed
		const oldLinks = (oldContent.match(/\[\[|\]\(/g) || []).length;
		const newLinks = (newContent.match(/\[\[|\]\(/g) || []).length;

		// This is a rough estimate - the actual implementation could be more precise
		return Math.abs(newLinks - oldLinks);
	}
}