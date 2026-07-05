use std::path::Path;
use std::process::Command;

use crate::utils::Error;

pub struct GitSync;

impl GitSync {
    fn git_dir(notes_dir: &Path) -> std::path::PathBuf {
        notes_dir.join(".git")
    }

    pub fn is_repo(notes_dir: &Path) -> bool {
        Self::git_dir(notes_dir).exists()
    }

    pub fn init(notes_dir: &Path) -> Result<(), Error> {
        if Self::is_repo(notes_dir) {
            return Ok(());
        }
        let output = Command::new("git")
            .args(["init"])
            .current_dir(notes_dir)
            .output()
            .map_err(|e| Error::General(format!("git init failed: {}", e)))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(Error::General(format!("git init error: {}", stderr)));
        }
        // set user config if not set
        Command::new("git")
            .args(["config", "user.email", "rili@local"])
            .current_dir(notes_dir)
            .output().ok();
        Command::new("git")
            .args(["config", "user.name", "RILI"])
            .current_dir(notes_dir)
            .output().ok();
        Ok(())
    }

    pub fn commit(notes_dir: &Path, message: &str) -> Result<(), Error> {
        Self::init(notes_dir)?;
        // add all .md files
        Command::new("git")
            .args(["add", "--", "*.md"])
            .current_dir(notes_dir)
            .output()
            .map_err(|e| Error::General(format!("git add failed: {}", e)))?;
        // check if there are changes
        let status = Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(notes_dir)
            .output()
            .map_err(|e| Error::General(format!("git status failed: {}", e)))?;
        let output_str = String::from_utf8_lossy(&status.stdout);
        if output_str.trim().is_empty() {
            return Ok(()); // nothing to commit
        }
        let output = Command::new("git")
            .args(["commit", "-m", message])
            .current_dir(notes_dir)
            .output()
            .map_err(|e| Error::General(format!("git commit failed: {}", e)))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(Error::General(format!("git commit error: {}", stderr)));
        }
        Ok(())
    }

    pub fn log(notes_dir: &Path, max_count: u32) -> Result<Vec<String>, Error> {
        if !Self::is_repo(notes_dir) {
            return Ok(vec![]);
        }
        let output = Command::new("git")
            .args(["log", "--oneline", "--abbrev-commit", "--max-count", &max_count.to_string()])
            .current_dir(notes_dir)
            .output()
            .map_err(|e| Error::General(format!("git log failed: {}", e)))?;
        let output_str = String::from_utf8_lossy(&output.stdout);
        Ok(output_str.lines().map(|l| l.to_string()).collect())
    }

    pub fn add_remote(notes_dir: &Path, url: &str) -> Result<(), Error> {
        Self::init(notes_dir)?;
        // check if remote origin already exists
        let check = Command::new("git")
            .args(["remote", "get-url", "origin"])
            .current_dir(notes_dir)
            .output();
        if let Ok(output) = check {
            if output.status.success() {
                // update remote url
                Command::new("git")
                    .args(["remote", "set-url", "origin", url])
                    .current_dir(notes_dir)
                    .output()
                    .map_err(|e| Error::General(format!("git remote set-url failed: {}", e)))?;
                return Ok(());
            }
        }
        Command::new("git")
            .args(["remote", "add", "origin", url])
            .current_dir(notes_dir)
            .output()
            .map_err(|e| Error::General(format!("git remote add failed: {}", e)))?;
        Ok(())
    }

    pub fn remove_remote(notes_dir: &Path) -> Result<(), Error> {
        Command::new("git")
            .args(["remote", "remove", "origin"])
            .current_dir(notes_dir)
            .output()
            .map_err(|e| Error::General(format!("git remote remove failed: {}", e)))?;
        Ok(())
    }

    pub fn get_remote_url(notes_dir: &Path) -> Result<Option<String>, Error> {
        if !Self::is_repo(notes_dir) {
            return Ok(None);
        }
        let output = Command::new("git")
            .args(["remote", "get-url", "origin"])
            .current_dir(notes_dir)
            .output();
        match output {
            Ok(o) if o.status.success() => {
                Ok(Some(String::from_utf8_lossy(&o.stdout).trim().to_string()))
            }
            _ => Ok(None),
        }
    }

    pub fn push(notes_dir: &Path) -> Result<String, Error> {
        let output = Command::new("git")
            .args(["push", "-u", "origin", "master", "--force"])
            .current_dir(notes_dir)
            .output()
            .map_err(|e| Error::General(format!("git push failed: {}", e)))?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if !output.status.success() {
            return Err(Error::General(format!("git push error: {}", stderr)));
        }
        Ok(if stdout.trim().is_empty() { stderr.trim().to_string() } else { stdout.trim().to_string() })
    }

    pub fn pull(notes_dir: &Path) -> Result<String, Error> {
        if !Self::is_repo(notes_dir) {
            return Err(Error::General("Not a git repository".into()));
        }
        let output = Command::new("git")
            .args(["pull", "origin", "master"])
            .current_dir(notes_dir)
            .output()
            .map_err(|e| Error::General(format!("git pull failed: {}", e)))?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if !output.status.success() {
            return Err(Error::General(format!("git pull error: {}", stderr)));
        }
        Ok(if stdout.trim().is_empty() { stderr.trim().to_string() } else { stdout.trim().to_string() })
    }
}
