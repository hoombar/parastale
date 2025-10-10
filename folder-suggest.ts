import { AbstractInputSuggest, App, TFolder } from 'obsidian';

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private onSelectCallback?: (value: string) => void;

	constructor(app: App, inputEl: HTMLInputElement, onSelectCallback?: (value: string) => void) {
		super(app, inputEl);
		this.onSelectCallback = onSelectCallback;
	}

	getSuggestions(query: string): TFolder[] {
		const allFolders = this.app.vault.getAllFolders();
		const lowerCaseInputStr = query.toLowerCase();

		return allFolders.filter((folder: TFolder) => {
			return folder.path.toLowerCase().contains(lowerCaseInputStr);
		});
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.createEl('div', { text: folder.path });
	}

	selectSuggestion(folder: TFolder): void {
		this.setValue(folder.path);
		if (this.onSelectCallback) {
			this.onSelectCallback(folder.path);
		}
		this.close();
	}
}