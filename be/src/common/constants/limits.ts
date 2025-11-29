// Team limits
export const TEAM_NAME_MIN = 1;
export const TEAM_NAME_MAX = 50;

// Project limits
export const MAX_PROJECTS_PER_TEAM = 15;
export const PROJECT_NAME_MIN = 1;
export const PROJECT_NAME_MAX = 100;
export const PROJECT_DESCRIPTION_MAX = 2000;

// Issue limits
export const MAX_ISSUES_PER_PROJECT = 200;
export const ISSUE_TITLE_MIN = 1;
export const ISSUE_TITLE_MAX = 200;
export const ISSUE_DESCRIPTION_MAX = 5000;

// Subtask limits
export const MAX_SUBTASKS_PER_ISSUE = 20;
export const SUBTASK_TITLE_MIN = 1;
export const SUBTASK_TITLE_MAX = 200;

// Label limits
export const MAX_LABELS_PER_PROJECT = 20;
export const MAX_LABELS_PER_ISSUE = 5;
export const LABEL_NAME_MIN = 1;
export const LABEL_NAME_MAX = 30;

// Status limits
export const MAX_CUSTOM_STATUSES_PER_PROJECT = 5;

// Comment limits
export const COMMENT_CONTENT_MIN = 1;
export const COMMENT_CONTENT_MAX = 1000;

// User limits
export const USER_NAME_MIN = 1;
export const USER_NAME_MAX = 50;
export const EMAIL_MAX_LENGTH = 255;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 100;

// Time limits
export const TOKEN_EXPIRATION_HOURS = 24;
export const PASSWORD_RESET_EXPIRATION_HOURS = 1;
export const TEAM_INVITE_EXPIRATION_DAYS = 7;

// AI limits
export const AI_MIN_DESCRIPTION_LENGTH = 10;
export const AI_MIN_COMMENT_COUNT = 5;
export const AI_MAX_REQUESTS_PER_MINUTE = 10;
export const AI_MAX_REQUESTS_PER_DAY = 100;

// WIP limits
export const WIP_LIMIT_MIN = 1;
export const WIP_LIMIT_MAX = 50;
