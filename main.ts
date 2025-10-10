import { App, Plugin, TFile, TFolder, Notice, Menu } from 'obsidian';
import { PARAArchiveSettings, DEFAULT_SETTINGS } from './settings';
import { PARAArchiveSettingTab } from './settings-tab';
import { Archiver } from './archiver';
import { LinkUpdater, LinkUpdate } from './link-updater';
import { ArchiveConfirmationModal } from './confirmation-modal';

export default class PARAArchivePlugin extends Plugin {
	settings: PARAArchiveSettings;
	private archiver: Archiver;
	private linkUpdater: LinkUpdater;

	async onload() {
		await this.loadSettings();

		// Initialize components
		this.archiver = new Archiver(this.app.vault);
		this.linkUpdater = new LinkUpdater(this.app);

		// Add settings tab
		this.addSettingTab(new PARAArchiveSettingTab(this.app, this));

		// Register file menu event for right-click context menu
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: Menu, file: TFile | TFolder) => {
				this.addArchiveMenuItem(menu, file);
			})
		);

		// Add command for archiving current file
		this.addCommand({
			id: 'archive-current-file',
			name: 'Archive current file',
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					if (!checking) {
						this.archiveFile(activeFile);
					}
					return true;
				}
				return false;
			}
		});
	}

	onunload() {
		// Cleanup if needed
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private addArchiveMenuItem(menu: Menu, file: TFile | TFolder) {
		// Check if the file is already in an archive folder
		if (this.archiver.isFileInArchive(file.path, this.settings.archiveConfigs)) {
			return; // Don't show archive option for files already in archive
		}

		// Find the appropriate archive configuration
		const config = this.archiver.findArchiveConfig(file.path, this.settings.archiveConfigs);
		if (!config) {
			return; // No applicable configuration found
		}

		menu.addItem((item) => {
			item.setTitle('PARA Archive')
				.setIcon('archive')
				.onClick(() => {
					this.archiveFile(file);
				});
		});
	}

	private async archiveFile(file: TFile | TFolder) {
		try {
			// Find the appropriate archive configuration
			const config = this.archiver.findArchiveConfig(file.path, this.settings.archiveConfigs);
			if (!config) {
				new Notice('No archive configuration found for this file location');
				return;
			}

			// Check if file is already in archive
			if (this.archiver.isFileInArchive(file.path, this.settings.archiveConfigs)) {
				new Notice('File is already in an archive folder');
				return;
			}

			// Generate destination path
			const destinationPath = this.archiver.generateArchivePath(file.path, config);

			// Prepare link updates if needed
			let linkUpdates: LinkUpdate[] = [];
			if (this.settings.linkUpdateMode !== 'never') {
				if (file instanceof TFile) {
					linkUpdates = await this.linkUpdater.prepareLinkUpdates(file.path, destinationPath);
				} else if (file instanceof TFolder) {
					linkUpdates = await this.linkUpdater.prepareFolderLinkUpdates(file.path, destinationPath);
				}
			}

			// Show confirmation if enabled
			if (this.settings.showConfirmation) {
				new ArchiveConfirmationModal(
					this.app,
					file,
					config,
					destinationPath,
					linkUpdates,
					async () => {
						await this.performArchive(file, config, destinationPath, linkUpdates);
					},
					() => {
						// User cancelled
					}
				).open();
			} else {
				await this.performArchive(file, config, destinationPath, linkUpdates);
			}

		} catch (error) {
			console.error('Archive operation failed:', error);
			new Notice(`Archive failed: ${error.message}`);
		}
	}

	private async performArchive(
		file: TFile | TFolder,
		config: any,
		destinationPath: string,
		linkUpdates: LinkUpdate[]
	) {
		try {
			// Archive the file
			await this.archiver.archiveFile(file, config);

			// Update links if configured and there are updates
			if (this.settings.linkUpdateMode === 'always' && linkUpdates.length > 0) {
				const result = await this.linkUpdater.applyLinkUpdates(linkUpdates);

				if (result.failed.length > 0) {
					new Notice(`File archived. Updated ${result.success} files, failed to update ${result.failed.length} files.`);
				} else {
					new Notice(`File archived successfully. Updated ${result.success} files with links.`);
				}
			} else if (this.settings.linkUpdateMode === 'ask' && linkUpdates.length > 0) {
				// Show a separate modal or notice asking about link updates
				new Notice(`File archived. ${linkUpdates.length} files contain links to this file. Use the command palette to update links if needed.`);
			} else {
				new Notice('File archived successfully');
			}

		} catch (error) {
			console.error('Archive operation failed:', error);
			new Notice(`Archive failed: ${error.message}`);
		}
	}
}