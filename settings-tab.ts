import { App, PluginSettingTab, Setting } from 'obsidian';
import PARAArchivePlugin from './main';
import { ArchiveConfig, ArchiveMode, LinkUpdateMode } from './settings';

export class PARAArchiveSettingTab extends PluginSettingTab {
	plugin: PARAArchivePlugin;

	constructor(app: App, plugin: PARAArchivePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'PARA Archive Settings' });

		// Global settings
		new Setting(containerEl)
			.setName('Show confirmation dialog')
			.setDesc('Show a confirmation dialog before archiving files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showConfirmation)
				.onChange(async (value) => {
					this.plugin.settings.showConfirmation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Link update mode')
			.setDesc('How to handle internal links when archiving files')
			.addDropdown(dropdown => dropdown
				.addOption('always', 'Always update links')
				.addOption('ask', 'Ask before updating')
				.addOption('never', 'Never update links')
				.setValue(this.plugin.settings.linkUpdateMode)
				.onChange(async (value: LinkUpdateMode) => {
					this.plugin.settings.linkUpdateMode = value;
					await this.plugin.saveSettings();
				}));

		// Archive configurations
		containerEl.createEl('h3', { text: 'Archive Configurations' });
		containerEl.createEl('p', { text: 'Configure different archive setups for different parts of your vault (e.g., Personal, Work)' });

		// Add new config button
		new Setting(containerEl)
			.setName('Add new archive configuration')
			.addButton(button => button
				.setButtonText('Add')
				.setCta()
				.onClick(() => {
					this.addNewArchiveConfig();
				}));

		// Display existing configs
		this.plugin.settings.archiveConfigs.forEach((config, index) => {
			this.displayArchiveConfig(containerEl, config, index);
		});
	}

	private addNewArchiveConfig(): void {
		const newConfig: ArchiveConfig = {
			id: Date.now().toString(),
			name: 'New Configuration',
			rootPath: '',
			archivePath: 'Archive',
			archiveMode: 'date-based'
		};

		this.plugin.settings.archiveConfigs.push(newConfig);
		this.plugin.saveSettings();
		this.display(); // Refresh the settings tab
	}

	private displayArchiveConfig(containerEl: HTMLElement, config: ArchiveConfig, index: number): void {
		const configDiv = containerEl.createDiv('archive-config');
		configDiv.createEl('h4', { text: `Configuration: ${config.name}` });

		new Setting(configDiv)
			.setName('Configuration name')
			.setDesc('A friendly name for this archive configuration')
			.addText(text => text
				.setValue(config.name)
				.onChange(async (value) => {
					config.name = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		new Setting(configDiv)
			.setName('Root path')
			.setDesc('The root folder path this configuration applies to (e.g., "Personal", "Work"). Leave empty for vault root.')
			.addText(text => text
				.setValue(config.rootPath)
				.onChange(async (value) => {
					config.rootPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(configDiv)
			.setName('Archive path')
			.setDesc('The folder where archived files will be moved (relative to root path)')
			.addText(text => text
				.setValue(config.archivePath)
				.onChange(async (value) => {
					config.archivePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(configDiv)
			.setName('Archive mode')
			.setDesc('How files should be organized in the archive folder')
			.addDropdown(dropdown => dropdown
				.addOption('date-based', 'Date-based (YYYY-MM folders)')
				.addOption('path-mirror', 'Mirror original path structure')
				.setValue(config.archiveMode)
				.onChange(async (value: ArchiveMode) => {
					config.archiveMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(configDiv)
			.setName('Remove configuration')
			.addButton(button => button
				.setButtonText('Remove')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.archiveConfigs.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				}));

		configDiv.createEl('hr');
	}
}