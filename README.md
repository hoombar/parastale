<div align="center">
  <img src="parastale-logo.png" alt="PARASTALE Logo" width="400">
</div>

# PARA Archive Plugin for Obsidian

An Obsidian plugin that helps you archive files and folders using the PARA method with configurable archive strategies and smart link updating.

## Features

- **Right-click archiving**: Right-click on any file or folder to archive it using the PARA method
- **Multiple archive configurations**: Set up different archive configurations for different parts of your vault (e.g., Personal, Work)
- **Two archiving modes**:
  - **Date-based**: Creates `YYYY-MM` folders in your archive
  - **Path mirror**: Recreates the original folder structure in the archive
- **Smart link updating**: Automatically updates internal links when files are archived
- **Confirmation dialog**: Optional preview of what will happen before archiving
- **Archive detection**: Won't show archive option for files already in archive folders

## The PARA Method

The PARA method organizes information into four categories:
- **Projects**: Things with a deadline and specific outcome
- **Areas**: Ongoing responsibilities to maintain
- **Resources**: Topics of ongoing interest
- **Archive**: Inactive items from the other three categories

This plugin helps you move completed or inactive items to your Archive folder.

## Installation

### Manual Installation

1. Download the latest release from the GitHub releases page
2. Extract the files to your vault's `.obsidian/plugins/para-archive/` folder
3. Enable the plugin in Obsidian's Community Plugins settings

### For Development

1. Clone this repository into your vault's `.obsidian/plugins/` folder
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start development mode
4. Enable the plugin in Obsidian

## Configuration

1. Go to Settings → Community Plugins → PARA Archive
2. Configure your archive settings:

### Archive Configurations

Create multiple archive configurations for different parts of your vault:

- **Configuration name**: A friendly name (e.g., "Personal", "Work")
- **Root path**: The folder this configuration applies to (e.g., "Personal", "Work")
- **Archive path**: Where files should be archived (e.g., "Personal/4-Archive")
- **Archive mode**: Choose between date-based or path-mirror organization

### Global Settings

- **Show confirmation dialog**: Preview the archive operation before executing
- **Link update mode**:
  - Always update links automatically
  - Ask before updating links
  - Never update links

## Usage

### Right-click Method

1. Right-click on any file or folder in the file explorer
2. Select "PARA Archive" from the context menu
3. Confirm the operation (if confirmation is enabled)

### Command Palette

Use the command "Archive current file" to archive the currently active file.

## Archive Modes

### Date-based Mode

Files are organized by the current month:
```
Archive/
├── 2025-01/
│   ├── completed-project.md
│   └── old-notes.md
├── 2025-02/
│   └── finished-task.md
```

### Path Mirror Mode

The original folder structure is preserved in the archive:
```
Original: Projects/Website/Design/mockups.md
Archived: Archive/Website/Design/mockups.md
```

## Link Updating

When you archive a file, the plugin can automatically update all internal links that point to that file:

- **Wikilinks**: `[[filename]]` → `[[archive/path/filename]]`
- **Markdown links**: `[text](path/file.md)` → `[text](archive/path/file.md)`
- **Embedded files**: `![[image]]` → `![[archive/path/image]]`
- **Links with anchors**: `[[file#header]]` → `[[archive/path/file#header]]`

## Development

This plugin is built with TypeScript and uses the Obsidian API.

### Build Commands

- `npm run dev`: Development mode with file watching
- `npm run build`: Production build
- `npm run version`: Update version numbers

### Project Structure

- `main.ts`: Main plugin class and event handlers
- `settings.ts`: Settings interface and types
- `settings-tab.ts`: Settings UI
- `archiver.ts`: Core archiving logic
- `link-updater.ts`: Link detection and updating
- `confirmation-modal.ts`: Confirmation dialog
- `styles.css`: Plugin styling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

If you encounter issues or have feature requests, please create an issue on the GitHub repository.