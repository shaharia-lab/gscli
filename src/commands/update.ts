import { Command } from 'commander';
import { checkForUpdate, performUpdate, getCurrentVersion } from '../lib/updater.js';
import { showError, showSuccess, showInfo } from '../lib/formatter.js';
import ora from 'ora';

export function createUpdateCommand(): Command {
  const update = new Command('update');
  update.description('Update gscli to the latest version');

  // Check command
  update
    .command('check')
    .description('Check for available updates')
    .action(async () => {
      const spinner = ora('Checking for updates...').start();
      
      try {
        const result = await checkForUpdate();
        spinner.stop();
        
        if (result.updateAvailable) {
          showInfo(`Update available: ${result.currentVersion} → ${result.latestVersion}`);
          console.log('\nRun "gscli update" to install the latest version.');
        } else {
          showSuccess(`You are on the latest version (${result.currentVersion})`);
        }
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  // Update command (default)
  update
    .action(async () => {
      const spinner = ora('Checking for updates...').start();
      
      try {
        const result = await checkForUpdate();
        
        if (!result.updateAvailable) {
          spinner.stop();
          showSuccess(`You are already on the latest version (${result.currentVersion})`);
          return;
        }
        
        spinner.text = `Updating ${result.currentVersion} → ${result.latestVersion}...`;
        
        await performUpdate();
        
        spinner.stop();
        showSuccess(`Updated successfully to version ${result.latestVersion}!`);
        console.log('\nPlease restart the CLI to use the new version.');
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  return update;
}

