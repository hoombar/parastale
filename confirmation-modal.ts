import { App, Modal, Setting, TFile, TFolder } from 'obsidian';
import { ArchiveConfig } from './settings';
import { LinkUpdate } from './link-updater';

export class ArchiveConfirmationModal extends Modal {
	private file: TFile | TFolder;
	private config: ArchiveConfig;
	private destinationPath: string;
	private linkUpdates: LinkUpdate[];
	private onConfirm: () => Promise<void>;
	private onCancel: () => void;

	constructor(
		app: App,
		file: TFile | TFolder,
		config: ArchiveConfig,
		destinationPath: string,
		linkUpdates: LinkUpdate[],
		onConfirm: () => Promise<void>,
		onCancel: () => void
	) {
		super(app);
		this.file = file;
		this.config = config;
		this.destinationPath = destinationPath;
		this.linkUpdates = linkUpdates;
		this.onConfirm = onConfirm;
		this.onCancel = onCancel;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Confirm Archive Operation' });

		// File information
		const fileInfoDiv = contentEl.createDiv('archive-file-info');
		fileInfoDiv.createEl('h3', { text: 'File to Archive' });

		const fileTypeIcon = this.file instanceof TFile ? '📄' : '📁';
		fileInfoDiv.createEl('p', {
			text: `${fileTypeIcon} ${this.file.name}`,
			cls: 'archive-file-name'
		});

		fileInfoDiv.createEl('p', {
			text: `Current path: ${this.file.path}`,
			cls: 'archive-current-path'
		});

		// Archive information
		const archiveInfoDiv = contentEl.createDiv('archive-destination-info');
		archiveInfoDiv.createEl('h3', { text: 'Archive Details' });

		archiveInfoDiv.createEl('p', { text: `Configuration: ${this.config.name}` });
		archiveInfoDiv.createEl('p', { text: `Archive mode: ${this.config.archiveMode}` });
		archiveInfoDiv.createEl('p', {
			text: `Destination: ${this.destinationPath}`,
			cls: 'archive-destination-path'
		});

		// Link updates information
		if (this.linkUpdates.length > 0) {
			const linkInfoDiv = contentEl.createDiv('archive-link-info');
			linkInfoDiv.createEl('h3', { text: 'Link Updates' });

			const totalLinks = this.linkUpdates.reduce((sum, update) => sum + update.linkCount, 0);
			linkInfoDiv.createEl('p', {
				text: `${this.linkUpdates.length} files with ${totalLinks} links will be updated`
			});

			// Show files that will be updated (limit to first 5)
			const fileList = linkInfoDiv.createEl('ul', { cls: 'archive-link-files' });
			const filesToShow = this.linkUpdates.slice(0, 5);

			filesToShow.forEach(update => {
				const listItem = fileList.createEl('li');
				listItem.createEl('span', { text: update.file.name, cls: 'file-name' });
				listItem.createEl('span', {
					text: ` (${update.linkCount} links)`,
					cls: 'link-count'
				});
			});

			if (this.linkUpdates.length > 5) {
				fileList.createEl('li', {
					text: `... and ${this.linkUpdates.length - 5} more files`,
					cls: 'more-files'
				});
			}
		} else {
			const noLinksDiv = contentEl.createDiv('archive-no-links');
			noLinksDiv.createEl('p', {
				text: 'No links to this file were found.',
				cls: 'no-links-message'
			});
		}

		// Warning if destination exists
		const existingFile = this.app.vault.getAbstractFileByPath(this.destinationPath);
		if (existingFile) {
			const warningDiv = contentEl.createDiv('archive-warning');
			warningDiv.createEl('p', {
				text: '⚠️ A file or folder already exists at the destination path. It will be overwritten.',
				cls: 'warning-message'
			});
		}

		// Buttons
		const buttonDiv = contentEl.createDiv('archive-buttons');
		buttonDiv.createEl('button', { text: 'Cancel' })
			.addEventListener('click', () => {
				this.onCancel();
				this.close();
			});

		const confirmButton = buttonDiv.createEl('button', {
			text: 'Archive',
			cls: 'mod-cta'
		});
		confirmButton.addEventListener('click', async () => {
			confirmButton.disabled = true;
			confirmButton.textContent = 'Archiving...';

			try {
				await this.onConfirm();
				this.close();
			} catch (error) {
				confirmButton.disabled = false;
				confirmButton.textContent = 'Archive';
				console.error('Archive operation failed:', error);
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}