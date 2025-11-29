import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface SeedUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

interface SeedTeam {
  id: string;
  name: string;
  owner_id: string;
}

interface SeedProject {
  id: string;
  name: string;
  description?: string;
  team_id: string;
  owner_id: string;
}

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);
  private readonly TARGET_USER_EMAIL = 'chinhnn21@gmail.com';
  private readonly TARGET_USER_PASSWORD = 'password';
  private readonly TARGET_USER_NAME = 'Chinh Nguyen';

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Clear all data from database (for fresh seed)
   * Note: This will delete all data. Use with caution!
   */
  async clearDatabase() {
    const supabaseAdmin = this.supabaseService.getAdmin();
    this.logger.log('Clearing database...');

    // Tables with created_at column
    const tablesWithCreatedAt = [
      'issue_activities',
      'comments',
      'subtasks',
      'issues',
      'project_favorites',
      'project_statuses',
      'labels',
      'projects',
      'teams',
      'users',
    ];

    // Tables with joined_at instead of created_at
    const tablesWithJoinedAt = ['team_members'];

    // Junction tables without created_at (use composite key filter)
    const junctionTables = ['issue_labels'];

    for (const table of tablesWithCreatedAt) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .gte('created_at', '1970-01-01'); // Matches all records

      if (error) {
        this.logger.error(`Error clearing ${table}: ${error.message}`);
      } else {
        this.logger.log(`Cleared ${table}`);
      }
    }

    // Handle tables with joined_at
    for (const table of tablesWithJoinedAt) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .gte('joined_at', '1970-01-01'); // Matches all records

      if (error) {
        this.logger.error(`Error clearing ${table}: ${error.message}`);
      } else {
        this.logger.log(`Cleared ${table}`);
      }
    }

    // Handle junction tables - delete using one of the foreign keys
    for (const table of junctionTables) {
      // For issue_labels, we can delete by checking if issue_id exists
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .neq('issue_id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        this.logger.error(`Error clearing ${table}: ${error.message}`);
      } else {
        this.logger.log(`Cleared ${table}`);
      }
    }

    this.logger.log('Database cleared successfully');
  }

  /**
   * Seed all data
   */
  async seed() {
    this.logger.log('Starting seed process...');

    try {
      // Step 1: Ensure target user exists and get its ID first
      this.logger.log(
        `Step 1: Ensuring target user exists (email: ${this.TARGET_USER_EMAIL})...`,
      );
      const users = await this.seedUsers();

      if (!users || users.length === 0) {
        throw new Error('Failed to get or create target user');
      }

      const targetUser = users[0];
      if (!targetUser.id) {
        throw new Error('Target user does not have a valid ID');
      }

      this.logger.log(
        `✓ Target user ready: ${targetUser.email} (ID: ${targetUser.id})`,
      );
      this.logger.log('Proceeding with seeding data for this user...');

      // Step 2: Seed in order respecting foreign key constraints
      const teams = await this.seedTeams(users);
      const projects = await this.seedProjects(users, teams);
      await this.seedProjectStatuses(projects);
      await this.seedLabels(projects);
      const issues = await this.seedIssues(users, projects);
      await this.seedSubtasks(issues);
      await this.seedComments(users, issues);
      await this.seedIssueLabels(issues);
      await this.seedProjectFavorites(users, projects);
      await this.seedIssueActivities(users, issues);

      this.logger.log('Seed process completed successfully!');
      this.logger.log(
        `All data seeded for user: ${targetUser.email} (ID: ${targetUser.id})`,
      );
      return {
        users: users.length,
        teams: teams.length,
        projects: projects.length,
        issues: issues.length,
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
      };
    } catch (error) {
      this.logger.error('Seed process failed:', error);
      throw error;
    }
  }

  /**
   * Seed users - get or create target user and ensure ID is available
   * This method ensures the target user exists and returns its ID for seeding
   * IMPORTANT: This method ensures ID consistency between auth.users and public.users
   */
  private async seedUsers(): Promise<SeedUser[]> {
    const supabaseAdmin = this.supabaseService.getAdmin();
    this.logger.log(
      `Getting or creating target user with email: ${this.TARGET_USER_EMAIL}...`,
    );

    // Step 1: Check if user exists in auth.users (Supabase Auth) first
    // This is critical because login uses auth.users, and we need to match IDs
    const {
      data: { users: authUsers },
    } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authUsers?.find((u) => u.email === this.TARGET_USER_EMAIL);

    // Step 2: Check if user exists in public.users
    const { data: publicUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, avatar_url')
      .eq('email', this.TARGET_USER_EMAIL)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" error
      this.logger.error(
        `Error fetching user with email ${this.TARGET_USER_EMAIL}: ${fetchError.message}`,
      );
      throw fetchError;
    }

    // Step 3: Handle different scenarios
    if (authUser && publicUser) {
      // User exists in both tables - verify IDs match
      if (authUser.id !== publicUser.id) {
        this.logger.warn(
          `⚠️ ID mismatch detected! auth.users.id=${authUser.id}, public.users.id=${publicUser.id}`,
        );
        this.logger.warn(
          'This can cause teams not to show. Updating public.users to match auth.users...',
        );
        // Update public.users to match auth.users ID (auth.users is source of truth for login)
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ id: authUser.id })
          .eq('email', this.TARGET_USER_EMAIL);

        if (updateError) {
          this.logger.error(`Failed to sync user ID: ${updateError.message}`);
          throw updateError;
        }

        // Fetch updated user
        const { data: updatedUser } = await supabaseAdmin
          .from('users')
          .select('id, email, name, avatar_url')
          .eq('email', this.TARGET_USER_EMAIL)
          .single();

        if (!updatedUser || !updatedUser.id) {
          throw new Error('Failed to get updated user');
        }

        this.logger.log(
          `✓ User ID synced: ${updatedUser.email} (ID: ${updatedUser.id})`,
        );
        return [updatedUser as SeedUser];
      }

      // IDs match - use public.users data
      this.logger.log(
        `✓ Target user found in both tables: ${publicUser.email} (ID: ${publicUser.id})`,
      );
      return [publicUser as SeedUser];
    }

    if (authUser && !publicUser) {
      // User exists in auth.users but not in public.users - sync it
      this.logger.log(
        `User exists in auth.users but not in public.users. Syncing...`,
      );

      const authUserId = authUser.id;
      const authUserEmail = authUser.email || this.TARGET_USER_EMAIL;
      const authUserName =
        (authUser.user_metadata?.name as string) || this.TARGET_USER_NAME;
      const authUserAvatar =
        (authUser.user_metadata?.avatar_url as string) ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
          authUserName,
        )}`;
      const { data: syncedUser, error: syncError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUserId, // Use auth.users ID (source of truth)
          email: authUserEmail,
          name: authUserName,
          avatar_url: authUserAvatar,
        })
        .select()
        .single();

      if (syncError) {
        if (syncError.code === '23505') {
          // Race condition - fetch existing
          const { data: fetchedUser } = await supabaseAdmin
            .from('users')
            .select('id, email, name, avatar_url')
            .eq('email', this.TARGET_USER_EMAIL)
            .single();

          if (fetchedUser && fetchedUser.id) {
            this.logger.log(
              `✓ User synced (race condition): ${fetchedUser.email} (ID: ${fetchedUser.id})`,
            );
            return [fetchedUser as SeedUser];
          }
        }
        this.logger.error(`Error syncing user: ${syncError.message}`);
        throw syncError;
      }

      if (!syncedUser || !(syncedUser as { id?: string }).id) {
        throw new Error('Synced user has no ID');
      }

      const syncedUserId = (syncedUser as { id: string }).id;
      const syncedUserEmail =
        (syncedUser as { email?: string }).email || this.TARGET_USER_EMAIL;
      this.logger.log(
        `✓ User synced to public.users: ${syncedUserEmail} (ID: ${syncedUserId})`,
      );
      return [syncedUser as SeedUser];
    }

    if (!authUser && publicUser) {
      // User exists in public.users but not in auth.users - this is unusual
      // We should create in auth.users to match, but this might fail if email is taken
      this.logger.warn(
        `⚠️ User exists in public.users but not in auth.users. This is unusual.`,
      );
      this.logger.warn(
        `Using public.users ID: ${publicUser.id}. If login fails, user may need to be recreated.`,
      );
      return [publicUser as SeedUser];
    }

    // Step 4: User doesn't exist in either table - create new user
    this.logger.log(
      `Target user with email ${this.TARGET_USER_EMAIL} does not exist. Creating user...`,
    );

    // Step 4a: Create user in Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.signUp({
        email: this.TARGET_USER_EMAIL,
        password: this.TARGET_USER_PASSWORD,
        options: {
          data: { name: this.TARGET_USER_NAME },
        },
      });

    if (authError) {
      // If user already exists (race condition), try to fetch from auth
      if (authError.message.includes('already registered')) {
        const {
          data: { users: retryAuthUsers },
        } = await supabaseAdmin.auth.admin.listUsers();
        const retryAuthUser = retryAuthUsers?.find(
          (u) => u.email === this.TARGET_USER_EMAIL,
        );

        if (retryAuthUser) {
          // Sync to public.users
          const retryAuthUserId = retryAuthUser.id;
          const retryAuthUserEmail =
            retryAuthUser.email || this.TARGET_USER_EMAIL;
          const retryAuthUserName =
            (retryAuthUser.user_metadata?.name as string) ||
            this.TARGET_USER_NAME;
          const { data: syncedUser, error: syncError } = await supabaseAdmin
            .from('users')
            .insert({
              id: retryAuthUserId,
              email: retryAuthUserEmail,
              name: retryAuthUserName,
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                retryAuthUserName,
              )}`,
            })
            .select()
            .single();

          if (syncError && syncError.code !== '23505') {
            this.logger.error(`Error syncing user: ${syncError.message}`);
            throw syncError;
          }

          if (syncError?.code === '23505') {
            // Already exists - fetch it
            const { data: fetchedUser } = await supabaseAdmin
              .from('users')
              .select('id, email, name, avatar_url')
              .eq('email', this.TARGET_USER_EMAIL)
              .single();

            if (fetchedUser && fetchedUser.id) {
              this.logger.log(
                `✓ User found after race condition: ${fetchedUser.email} (ID: ${fetchedUser.id})`,
              );
              return [fetchedUser as SeedUser];
            }
          }

          if (syncedUser && (syncedUser as { id?: string }).id) {
            const syncedUserId = (syncedUser as { id: string }).id;
            const syncedUserEmail =
              (syncedUser as { email?: string }).email ||
              this.TARGET_USER_EMAIL;
            this.logger.log(
              `✓ User synced: ${syncedUserEmail} (ID: ${syncedUserId})`,
            );
            return [syncedUser as SeedUser];
          }
        }
      }

      this.logger.error(`Error creating user in auth: ${authError.message}`);
      throw authError;
    }

    if (!authData.user || !authData.user.id) {
      throw new Error('Failed to create user in Supabase Auth - no user ID');
    }

    const userId = authData.user.id;
    this.logger.log(`✓ User created in Supabase Auth (ID: ${userId})`);

    // Step 4b: Auto-confirm email for development
    const { error: confirmError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });

    if (confirmError) {
      this.logger.warn(`Failed to auto-confirm email: ${confirmError.message}`);
      // Continue anyway
    } else {
      this.logger.log('✓ Email confirmed');
    }

    // Step 4c: Insert user into public.users table with same ID
    const { data: newUser, error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId, // CRITICAL: Use same ID as auth.users
        email: this.TARGET_USER_EMAIL,
        name: this.TARGET_USER_NAME,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(this.TARGET_USER_NAME)}`,
      })
      .select()
      .single();

    if (dbError) {
      // If user already exists in public.users (race condition), fetch it
      if (dbError.code === '23505') {
        this.logger.log(
          'User already exists in database (race condition), fetching...',
        );
        const { data: fetchedUser, error: fetchErr } = await supabaseAdmin
          .from('users')
          .select('id, email, name, avatar_url')
          .eq('email', this.TARGET_USER_EMAIL)
          .single();

        if (fetchErr) {
          this.logger.error(
            `Error fetching user after race condition: ${fetchErr.message}`,
          );
          throw fetchErr;
        }

        if (!fetchedUser || !fetchedUser.id) {
          throw new Error('Fetched user has no ID');
        }

        this.logger.log(
          `✓ User fetched after race condition: ${fetchedUser.email} (ID: ${fetchedUser.id})`,
        );
        return [fetchedUser as SeedUser];
      }

      this.logger.error(`Error creating user in database: ${dbError.message}`);
      throw dbError;
    }

    // Step 5: Validate the created user has ID
    if (!newUser || !newUser.id) {
      throw new Error('Created user has no ID');
    }

    this.logger.log(
      `✓ Target user created successfully: ${newUser.email} (ID: ${newUser.id})`,
    );
    return [newUser as SeedUser];
  }

  /**
   * Seed teams and team members - only teams owned by target user
   */
  private async seedTeams(users: SeedUser[]): Promise<SeedTeam[]> {
    const supabaseAdmin = this.supabaseService.getAdmin();
    this.logger.log('Seeding teams...');

    const targetUser = users[0]; // Only one user now

    const teamsData = [
      {
        name: 'My Development Team',
        owner: targetUser,
        members: [{ user: targetUser, role: 'OWNER' }],
      },
      {
        name: 'My Design Team',
        owner: targetUser,
        members: [{ user: targetUser, role: 'OWNER' }],
      },
      {
        name: 'My Marketing Team',
        owner: targetUser,
        members: [{ user: targetUser, role: 'OWNER' }],
      },
    ];

    const teams: SeedTeam[] = [];

    for (const teamData of teamsData) {
      // Check if team already exists
      const { data: existing } = await supabaseAdmin
        .from('teams')
        .select('id, name, owner_id')
        .eq('name', teamData.name)
        .eq('owner_id', targetUser.id)
        .single();

      let team: SeedTeam;

      if (existing) {
        this.logger.log(
          `Team ${teamData.name} already exists, skipping creation...`,
        );
        team = existing as SeedTeam;
      } else {
        const { data: newTeam, error: teamError } = await supabaseAdmin
          .from('teams')
          .insert({
            name: teamData.name,
            owner_id: teamData.owner.id,
          })
          .select()
          .single();

        if (teamError) {
          this.logger.error(
            `Error seeding team ${teamData.name}: ${teamError.message}`,
          );
          throw teamError;
        }

        team = newTeam;
        this.logger.log(`Seeded team: ${teamData.name}`);
      }

      // Seed team members
      for (const memberData of teamData.members) {
        const { data: existingMember } = await supabaseAdmin
          .from('team_members')
          .select('id')
          .eq('team_id', team.id)
          .eq('user_id', memberData.user.id)
          .single();

        if (existingMember) {
          continue;
        }

        const { error: memberError } = await supabaseAdmin
          .from('team_members')
          .insert({
            team_id: team.id,
            user_id: memberData.user.id,
            role: memberData.role,
          });

        if (memberError) {
          this.logger.error(
            `Error seeding team member: ${memberError.message}`,
          );
          // Continue with other members
        }
      }

      teams.push(team);
    }

    return teams;
  }

  /**
   * Seed projects - only projects owned by target user
   */
  private async seedProjects(
    users: SeedUser[],
    teams: SeedTeam[],
  ): Promise<SeedProject[]> {
    const supabaseAdmin = this.supabaseService.getAdmin();
    this.logger.log('Seeding projects...');

    const targetUser = users[0]; // Only one user now

    const projectsData = [
      {
        name: 'Website Redesign',
        description:
          'Complete redesign of the company website with modern UI/UX',
        team: teams[0], // My Development Team
        owner: targetUser,
      },
      {
        name: 'Mobile App Development',
        description: 'Building a new mobile application for iOS and Android',
        team: teams[0],
        owner: targetUser,
      },
      {
        name: 'Brand Identity',
        description: 'Creating a new brand identity and visual guidelines',
        team: teams[1], // My Design Team
        owner: targetUser,
      },
      {
        name: 'Social Media Campaign',
        description: 'Q1 social media marketing campaign',
        team: teams[2], // My Marketing Team
        owner: targetUser,
      },
      {
        name: 'API Integration',
        description: 'Integrating third-party APIs for payment processing',
        team: teams[0],
        owner: targetUser,
      },
    ];

    const projects: SeedProject[] = [];

    for (const projectData of projectsData) {
      const { data: existing } = await supabaseAdmin
        .from('projects')
        .select('id, name, description, team_id, owner_id')
        .eq('name', projectData.name)
        .eq('team_id', projectData.team.id)
        .eq('owner_id', targetUser.id)
        .single();

      if (existing) {
        this.logger.log(
          `Project ${projectData.name} already exists, skipping...`,
        );
        projects.push(existing as SeedProject);
        continue;
      }

      const { data: project, error } = await supabaseAdmin
        .from('projects')
        .insert({
          name: projectData.name,
          description: projectData.description,
          team_id: projectData.team.id,
          owner_id: projectData.owner.id,
        })
        .select()
        .single();

      if (error) {
        this.logger.error(
          `Error seeding project ${projectData.name}: ${error.message}`,
        );
        throw error;
      }

      projects.push(project);
      this.logger.log(`Seeded project: ${projectData.name}`);
    }

    return projects;
  }

  /**
   * Seed project statuses
   */
  private async seedProjectStatuses(projects: SeedProject[]) {
    const supabaseAdmin = this.supabaseService.getAdmin();
    this.logger.log('Seeding project statuses...');

    const defaultStatuses = ['Backlog', 'In Progress', 'Done'];
    const customStatuses = [
      { name: 'Review', position: 3 },
      { name: 'Testing', position: 4 },
    ];

    for (const project of projects) {
      // Skip first project (keep only defaults), add custom statuses to others
      const statusesToAdd =
        project === projects[0]
          ? defaultStatuses
          : [...defaultStatuses, ...customStatuses.map((s) => s.name)];

      for (let i = 0; i < statusesToAdd.length; i++) {
        const statusName = statusesToAdd[i];
        const customStatus = customStatuses.find((s) => s.name === statusName);

        const { data: existing } = await supabaseAdmin
          .from('project_statuses')
          .select('id')
          .eq('project_id', project.id)
          .eq('name', statusName)
          .single();

        if (existing) {
          continue;
        }

        const { error } = await supabaseAdmin.from('project_statuses').insert({
          project_id: project.id,
          name: statusName,
          position: customStatus?.position ?? i,
        });

        if (error) {
          this.logger.error(
            `Error seeding status ${statusName}: ${error.message}`,
          );
        }
      }
    }

    this.logger.log('Project statuses seeded');
  }

  /**
   * Seed labels
   */
  private async seedLabels(projects: SeedProject[]) {
    const supabaseAdmin = this.supabaseService.getAdmin();
    this.logger.log('Seeding labels...');

    const labelTemplates = [
      { name: 'Bug', color: '#EF4444' },
      { name: 'Feature', color: '#10B981' },
      { name: 'Enhancement', color: '#3B82F6' },
      { name: 'Documentation', color: '#8B5CF6' },
      { name: 'Urgent', color: '#F59E0B' },
    ];

    for (const project of projects) {
      for (const labelTemplate of labelTemplates) {
        const { data: existing } = await supabaseAdmin
          .from('labels')
          .select('id')
          .eq('project_id', project.id)
          .eq('name', labelTemplate.name)
          .single();

        if (existing) {
          continue;
        }

        const { error } = await supabaseAdmin.from('labels').insert({
          project_id: project.id,
          name: labelTemplate.name,
          color: labelTemplate.color,
        });

        if (error) {
          this.logger.error(
            `Error seeding label ${labelTemplate.name}: ${error.message}`,
          );
        }
      }
    }

    this.logger.log('Labels seeded');
  }

  /**
   * Seed issues
   */
  private async seedIssues(users: SeedUser[], projects: SeedProject[]) {
    const supabaseAdmin = this.supabaseService.getAdmin();
    this.logger.log('Seeding issues...');

    // Get labels for each project
    const projectLabelsMap = new Map<string, any[]>();
    for (const project of projects) {
      const { data: labels } = await supabaseAdmin
        .from('labels')
        .select('id, name')
        .eq('project_id', project.id);
      projectLabelsMap.set(project.id, labels || []);
    }

    // Get statuses for each project
    const projectStatusesMap = new Map<string, string[]>();
    for (const project of projects) {
      const { data: statuses } = await supabaseAdmin
        .from('project_statuses')
        .select('name')
        .eq('project_id', project.id)
        .order('position');
      projectStatusesMap.set(
        project.id,
        statuses?.map((s) => s.name) || ['Backlog', 'In Progress', 'Done'],
      );
    }

    const targetUser = users[0]; // Only one user now

    const issuesData = [
      {
        project: projects[0],
        title: 'Fix login button styling',
        description:
          'The login button on the homepage needs to be styled according to the design system',
        status: 'In Progress',
        priority: 'HIGH' as const,
        assignee: targetUser,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        labelNames: ['Bug'],
      },
      {
        project: projects[0],
        title: 'Add dark mode support',
        description:
          'Implement dark mode toggle and theme switching functionality',
        status: 'Backlog',
        priority: 'MEDIUM' as const,
        assignee: targetUser,
        labelNames: ['Feature'],
      },
      {
        project: projects[0],
        title: 'Optimize database queries',
        description:
          'Review and optimize slow database queries in the user service',
        status: 'Done',
        priority: 'MEDIUM' as const,
        assignee: targetUser,
        labelNames: ['Enhancement'],
      },
      {
        project: projects[1],
        title: 'Design mobile app icons',
        description: 'Create app icons for iOS and Android platforms',
        status: 'In Progress',
        priority: 'HIGH' as const,
        assignee: targetUser,
        labelNames: ['Feature'],
      },
      {
        project: projects[1],
        title: 'Set up CI/CD pipeline',
        description:
          'Configure continuous integration and deployment for mobile app',
        status: 'Backlog',
        priority: 'HIGH' as const,
        assignee: targetUser,
        labelNames: ['Enhancement', 'Urgent'],
      },
      {
        project: projects[2],
        title: 'Create brand color palette',
        description: 'Define primary and secondary color schemes for the brand',
        status: 'Done',
        priority: 'MEDIUM' as const,
        assignee: targetUser,
        labelNames: ['Feature'],
      },
      {
        project: projects[3],
        title: 'Plan Q1 social media content',
        description: 'Create content calendar for Q1 social media posts',
        status: 'In Progress',
        priority: 'HIGH' as const,
        assignee: targetUser,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        labelNames: ['Feature'],
      },
      {
        project: projects[4],
        title: 'Integrate Stripe payment API',
        description: 'Integrate Stripe API for processing payments',
        status: 'In Progress',
        priority: 'HIGH' as const,
        assignee: targetUser,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        labelNames: ['Feature', 'Urgent'],
      },
    ];

    const issues: any[] = [];

    for (let i = 0; i < issuesData.length; i++) {
      const issueData = issuesData[i];
      const statuses = projectStatusesMap.get(issueData.project.id) || [
        'Backlog',
      ];
      const validStatus = statuses.includes(issueData.status)
        ? issueData.status
        : statuses[0];

      const { data: issue, error } = await supabaseAdmin
        .from('issues')
        .insert({
          project_id: issueData.project.id,
          title: issueData.title,
          description: issueData.description,
          status: validStatus,
          priority: issueData.priority,
          assignee_id: issueData.assignee?.id,
          due_date: issueData.dueDate?.toISOString(),
          position: i,
        })
        .select()
        .single();

      if (error) {
        this.logger.error(
          `Error seeding issue ${issueData.title}: ${error.message}`,
        );
        throw error;
      }

      // Link labels
      if (issueData.labelNames && issueData.labelNames.length > 0) {
        const labels = projectLabelsMap.get(issueData.project.id) || [];
        for (const labelName of issueData.labelNames) {
          const label = labels.find((l) => l.name === labelName);
          if (label) {
            await supabaseAdmin.from('issue_labels').insert({
              issue_id: issue.id,
              label_id: label.id,
            });
          }
        }
      }

      issues.push(issue);
      this.logger.log(`Seeded issue: ${issueData.title}`);
    }

    return issues;
  }

  /**
   * Seed subtasks
   */
  private async seedSubtasks(issues: any[]) {
    const supabaseAdmin = this.supabaseService.getAdmin();
    this.logger.log('Seeding subtasks...');

    const subtasksData = [
      {
        issue: issues[0],
        title: 'Update button component styles',
        isCompleted: false,
      },
      {
        issue: issues[0],
        title: 'Test button on different browsers',
        isCompleted: true,
      },
      {
        issue: issues[3],
        title: 'Create iOS app icon (1024x1024)',
        isCompleted: false,
      },
      {
        issue: issues[3],
        title: 'Create Android app icon (512x512)',
        isCompleted: false,
      },
      {
        issue: issues[7],
        title: 'Set up Stripe account',
        isCompleted: true,
      },
      {
        issue: issues[7],
        title: 'Implement payment processing endpoint',
        isCompleted: false,
      },
      {
        issue: issues[7],
        title: 'Add error handling for failed payments',
        isCompleted: false,
      },
    ];

    for (let i = 0; i < subtasksData.length; i++) {
      const subtaskData = subtasksData[i];

      const { error } = await supabaseAdmin.from('subtasks').insert({
        issue_id: subtaskData.issue.id,
        title: subtaskData.title,
        is_completed: subtaskData.isCompleted,
        position: i,
      });

      if (error) {
        this.logger.error(
          `Error seeding subtask ${subtaskData.title}: ${error.message}`,
        );
      }
    }

    this.logger.log('Subtasks seeded');
  }

  /**
   * Seed comments
   */
  private async seedComments(users: SeedUser[], issues: any[]) {
    const supabaseAdmin = this.supabaseService.getAdmin();
    this.logger.log('Seeding comments...');

    const targetUser = users[0]; // Only one user now

    const commentsData = [
      {
        issue: issues[0],
        user: targetUser,
        content: 'I started working on this. Should be done by tomorrow.',
      },
      {
        issue: issues[0],
        user: targetUser,
        content: 'Thanks! Let me know if you need any design assets.',
      },
      {
        issue: issues[3],
        user: targetUser,
        content: 'Icons are ready. Need approval before finalizing.',
      },
      {
        issue: issues[7],
        user: targetUser,
        content:
          'Stripe API documentation is very clear. Should be straightforward.',
      },
      {
        issue: issues[7],
        user: targetUser,
        content:
          'Great! Make sure to handle edge cases for failed transactions.',
      },
    ];

    for (const commentData of commentsData) {
      const { error } = await supabaseAdmin.from('comments').insert({
        issue_id: commentData.issue.id,
        user_id: commentData.user.id,
        content: commentData.content,
      });

      if (error) {
        this.logger.error(`Error seeding comment: ${error.message}`);
      }
    }

    this.logger.log('Comments seeded');
  }

  /**
   * Seed issue labels (many-to-many already handled in seedIssues, but adding more)
   */
  private async seedIssueLabels(issues: any[]) {
    // Already handled in seedIssues, but this method can be used for additional labels
    this.logger.log('Issue labels already seeded during issue creation');
  }

  /**
   * Seed project favorites
   */
  private async seedProjectFavorites(
    users: SeedUser[],
    projects: SeedProject[],
  ) {
    const supabaseAdmin = this.supabaseService.getAdmin();
    this.logger.log('Seeding project favorites...');

    const targetUser = users[0]; // Only one user now

    const favorites = [
      { user: targetUser, project: projects[0] },
      { user: targetUser, project: projects[1] },
      { user: targetUser, project: projects[2] },
      { user: targetUser, project: projects[4] },
    ];

    for (const favorite of favorites) {
      const { data: existing } = await supabaseAdmin
        .from('project_favorites')
        .select('user_id')
        .eq('user_id', favorite.user.id)
        .eq('project_id', favorite.project.id)
        .single();

      if (existing) {
        continue;
      }

      const { error } = await supabaseAdmin.from('project_favorites').insert({
        user_id: favorite.user.id,
        project_id: favorite.project.id,
      });

      if (error) {
        this.logger.error(`Error seeding favorite: ${error.message}`);
      }
    }

    this.logger.log('Project favorites seeded');
  }

  /**
   * Seed issue activities
   */
  private async seedIssueActivities(users: SeedUser[], issues: any[]) {
    const supabaseAdmin = this.supabaseService.getAdmin();
    this.logger.log('Seeding issue activities...');

    const targetUser = users[0]; // Only one user now

    const activities = [
      {
        issue: issues[0],
        actor: targetUser,
        actionType: 'STATUS_CHANGE',
        oldValue: 'Backlog',
        newValue: 'In Progress',
      },
      {
        issue: issues[2],
        actor: targetUser,
        actionType: 'STATUS_CHANGE',
        oldValue: 'In Progress',
        newValue: 'Done',
      },
      {
        issue: issues[0],
        actor: targetUser,
        actionType: 'ASSIGN_CHANGE',
        oldValue: null,
        newValue: targetUser.id,
      },
    ];

    for (const activity of activities) {
      const { error } = await supabaseAdmin.from('issue_activities').insert({
        issue_id: activity.issue.id,
        actor_id: activity.actor.id,
        action_type: activity.actionType,
        old_value: activity.oldValue,
        new_value: activity.newValue,
      });

      if (error) {
        this.logger.error(`Error seeding activity: ${error.message}`);
      }
    }

    this.logger.log('Issue activities seeded');
  }
}
