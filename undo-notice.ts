import { Notice } from 'obsidian';

export class UndoNotice extends Notice {
	private undoCallback: () => void;
	private undoButton: HTMLButtonElement;
	private timeoutId: number;

	constructor(
		message: string,
		undoCallback: () => void,
		timeoutMs: number = 5000
	) {
		super('', timeoutMs);

		this.undoCallback = undoCallback;

		// Clear the default message
		this.messageEl.empty();

		// Create custom content
		this.createNoticeContent(message);

		// Auto-hide after timeout
		this.timeoutId = window.setTimeout(() => {
			this.hide();
		}, timeoutMs);
	}

	private createNoticeContent(message: string) {
		// Create container
		const container = this.messageEl.createDiv('undo-notice-container');

		// Create message text
		const messageEl = container.createSpan('undo-notice-message');
		messageEl.textContent = message;

		// Create undo button
		this.undoButton = container.createEl('button', {
			text: 'Undo',
			cls: 'undo-notice-button'
		});

		// Add click handler
		this.undoButton.addEventListener('click', this.handleUndo.bind(this));
	}

	private handleUndo() {
		// Clear the timeout to prevent auto-hide
		if (this.timeoutId) {
			window.clearTimeout(this.timeoutId);
		}

		// Execute the undo callback
		this.undoCallback();

		// Update the notice to show undo in progress
		this.showUndoInProgress();

		// Hide after a short delay
		setTimeout(() => {
			this.hide();
		}, 1500);
	}

	private showUndoInProgress() {
		this.messageEl.empty();

		const container = this.messageEl.createDiv('undo-notice-container');
		const messageEl = container.createSpan('undo-notice-message');
		messageEl.textContent = 'Undoing archive operation...';

		// Add a spinner or loading indicator
		const spinner = container.createSpan('undo-notice-spinner');
		spinner.textContent = '⏳';
	}

	hide() {
		if (this.timeoutId) {
			window.clearTimeout(this.timeoutId);
		}
		super.hide();
	}
}