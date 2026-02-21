# Project Workflow

## 1) One-Time GitHub Setup
- Create an empty GitHub repository.
- Add the remote here:

```powershell
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## 2) Daily Commit Flow
Run this at least once each day after your work:

```powershell
git add -A
git commit -m "daily: YYYY-MM-DD short note"
git push
```

## 3) Milestones (Rollback Points)
Use tags for milestones.

Term: `tag` = a named snapshot of a commit.

Before/after creating a tag, add a short entry to `MILESTONES.md`:
- date
- tag name
- short "what was done" summary
- rollback command

Create a milestone tag:

```powershell
git tag -a milestone-01-setup -m "Milestone 01: setup"
git push origin milestone-01-setup
```

Rollback safely (recommended):

```powershell
git switch -c restore/milestone-01 milestone-01-setup
```

This opens the old state in a new branch without deleting current progress.
