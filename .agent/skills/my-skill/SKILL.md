---
name: smart-task-automator
description: Autonomously perform user-defined tasks like code scaffolding, test execution, and deployment workflows with safety guards.
---

# Smart Task Automator Skill

## Goal:
When the user requests a complex workflow (like scaffold project, run tests, deploy, create documents), the agent should plan and execute steps reliably and safely.

## Instructions:
1. Analyze user request and break it down into ordered subtasks.
2. Generate an implementation plan with checkpoints.
3. Execute each step using the best available models and scripts.
4. Validate results output at each checkpoint.
5. If an error arises, backtrack only the related subtask and retry safely.
6. Summarize completed actions in a final report.

## Safety & Constraints:
- Do not delete user files without explicit confirmation.
- Always log command outputs before execution.
- Validate syntax errors first before applying changes.
- If user didn’t confirm, keep write operations preview-only.

## Example Cases:
- Scaffolding a new web project
- Running all unit tests and returning report
- Packaging and deploying to test environment