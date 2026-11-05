// Help / Playbook article content for the Kipu Support Metrics tool.
//
// Each article is a list of "blocks" that the Help page renders. Supported blocks:
//   { type: 'h2', text }                              section heading
//   { type: 'p', text }                               paragraph (supports **bold** inline)
//   { type: 'steps', items: [..] }                    numbered steps
//   { type: 'list', items: [..] }                     bullet list
//   { type: 'callout', variant: 'info'|'tip'|'warning', text }
//   { type: 'shot', id: 'HELP-001', caption }         screenshot placeholder (see public/help-images)
//   { type: 'table', headers: [..], rows: [[..]] }    simple table
//
// Screenshot workflow: every { type: 'shot' } has a unique id. The page first tries to
// load /help-images/<id>.jpg; if the file isn't there yet it shows a labelled placeholder.
// The full list of screenshots + what each should show lives in HELP_SCREENSHOTS below.

export const ARTICLES = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'signing-in',
    title: 'Signing In and Access',
    category: 'Daily Use',
    summary:
      'How to sign in, what the two kinds of account can do, and who to ask when you need access or a new password.',
    blocks: [
      { type: 'h2', text: 'Signing in' },
      {
        type: 'p',
        text:
          'The tracker now asks you to sign in. Enter the **email address** your account was set up with and your **password**, then click **Sign in**. You stay signed in on that browser, so you will not be asked again every time.',
      },
      {
        type: 'p',
        text:
          'Once you are in, the bottom of the left-hand menu shows the email you signed in with and whether you are an **Admin** or a **User**. The **Sign out** button is in the same place.',
      },
      {
        type: 'callout',
        variant: 'info',
        text:
          'Accounts are created for you — there is no "create an account" option, and no "forgot password" email. If you need an account, a password reset, or you have changed email address, ask an administrator.',
      },

      { type: 'h2', text: 'The two kinds of account' },
      {
        type: 'p',
        text:
          'Everyone sees the same menu. The difference is what you can change.',
      },
      {
        type: 'table',
        headers: ['Section', 'Admin', 'User'],
        rows: [
          ['Agent Performance, Team Dashboard', 'Full use', 'Full use'],
          ['Attendance Summary, Attendance Entry, Attendance Codes', 'Full use', 'Full use'],
          ['Supervisor Notes', 'Full use', 'Full use'],
          ['Agents, Teams, Team Assignments', 'Can add and edit', 'Can look, cannot change'],
          ['Metrics, Goals', 'Can add and edit', 'Can look, cannot change'],
          ['Help & Playbook', 'Full use', 'Full use'],
        ],
      },
      {
        type: 'p',
        text:
          'On the pages a User cannot change, the buttons are simply not there and a short note at the top says **"View only. Ask an administrator to make changes."** Everything on those pages can still be read, searched and filtered as normal.',
      },

      { type: 'h2', text: 'If something is not right' },
      {
        type: 'list',
        items: [
          '**"Email or password is incorrect."** — check the email address, then ask an administrator to reset your password. For your security the tool will not say whether an email address exists.',
          '**"No access"** after signing in — your account exists but has not been given access yet. Contact an administrator.',
          '**"Could not load your access"** — usually a connection problem rather than anything to do with your account. Click **Retry**; if it keeps happening, sign out and back in.',
          '**"Your sign-in has expired."** — you have been signed out after a long idle period. Sign in again and carry on.',
          '**"You do not have permission to do this."** — you tried something your account cannot do. Ask an administrator.',
        ],
      },
      {
        type: 'callout',
        variant: 'tip',
        text:
          'Signing out in one browser tab signs you out in the others too. If you share a computer, sign out when you are finished.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'goals',
    title: 'How to Use the Goals Section',
    category: 'Setup',
    summary:
      'Set the target each team is measured against for every metric from one grid — apply a goal to many teams at once, set tolerances, schedule goal changes with start and end dates, and fix teams that have ended up with two goals for the same metric.',
    blocks: [
      { type: 'h2', text: 'What a goal is, and why you set one' },
      {
        type: 'p',
        text:
          'A **goal** is the target a team is expected to hit for a single metric — for example, "CSAT % should be at least 96%" or "Average Resolution Time should be 5 days or fewer". Every metric on an agent or team scorecard is judged **On Track** or **Off Track** by comparing the actual result against the goal you set here.',
      },
      {
        type: 'p',
        text:
          'Goals are set **per team**, so the Billing team can have a different target than the CRM team for the same metric. If a metric has no goal for a team, the scorecard simply shows "No Goal" for it and it does not count for or against the rating.',
      },
      { type: 'h2', text: 'Reading the grid' },
      {
        type: 'p',
        text:
          'The Goals page is a single grid: **metrics down the side, teams across the top**. Each box shows the goal that team is running **today**. A dash means that team has no goal for that metric, which is perfectly normal — not every metric applies to every team.',
      },
      {
        type: 'p',
        text:
          'New teams and new metrics appear here on their own as soon as they are added, so the page never needs a developer to keep it up to date.',
      },
      { type: 'shot', id: 'HELP-001', caption: 'The Goals grid: metrics down the side, teams across the top.' },

      { type: 'h2', text: 'When would you add a goal?' },
      { type: 'p', text: 'You will typically add a goal in one of these situations:' },
      {
        type: 'list',
        items: [
          'A new team is onboarded and needs its targets defined.',
          'A new metric is introduced and each team needs a target for it.',
          'Leadership changes the target mid-year (for example, raising CSAT from 94% to 96%). See "Changing a goal over time" below — the tool handles the switchover for you.',
        ],
      },

      { type: 'h2', text: 'Adding a goal — one set of teams at a time' },
      {
        type: 'p',
        text:
          'Most goals are the same across teams, so you set the goal **once** and tick which teams it applies to, rather than repeating yourself team by team.',
      },
      {
        type: 'steps',
        items: [
          'Click the blue **+ Add Goal** button in the top-right of the Goals page.',
          'Choose the **Metric**, then type the **Goal** and any **Tolerance**.',
          'Set **Starts** — the day the goal takes effect. It defaults to today.',
          'Every team starts ticked. **Untick any team this goal does not apply to.** Beside each team you will see what it is running now, so you can tell at a glance who is changing.',
          'Click **Save**. Every ticked team gets the goal in one go.',
        ],
      },
      {
        type: 'callout',
        variant: 'tip',
        text:
          'Clicking a **dash** in the grid opens the same pop-up with that metric chosen and **only that one team ticked** — so adding a single missing goal never rolls anything out to the other teams by accident.',
      },
      { type: 'shot', id: 'HELP-002', caption: 'The + Add Goal button in the top-right corner.' },
      { type: 'shot', id: 'HELP-003', caption: 'The Add Goal pop-up with the team checklist.' },

      { type: 'h2', text: 'The Add Goal fields' },
      {
        type: 'table',
        headers: ['Field', 'What it means'],
        rows: [
          ['Metric', 'Which metric this goal is for (e.g. CSAT %, Call Accept %). Only active metrics appear in this list.'],
          ['Goal', 'The target number. For a percentage metric enter the number only (e.g. 96 for 96%). For a days metric enter the number of days (e.g. 5).'],
          ['Tolerance', 'Optional. How much wiggle room is allowed before a result is counted as Off Track. See "How tolerance works" below. Leave blank for no tolerance.'],
          ['Starts', 'The first day this goal is in effect. Whatever each ticked team is running now ends the day before, so there is never a gap or an overlap.'],
          ['Teams', 'Who the goal applies to. All teams are ticked to begin with — untick the ones it does not fit.'],
        ],
      },

      { type: 'h2', text: 'The Edit Goal fields' },
      {
        type: 'p',
        text:
          'Clicking a **value** in the grid opens that one goal in the full form, where every detail can be set by hand:',
      },
      {
        type: 'table',
        headers: ['Field', 'What it means'],
        rows: [
          ['Team', 'Which team this goal applies to.'],
          ['Metric', 'Which metric this goal is for.'],
          ['Goal Value', 'The target number.'],
          ['Tolerance (±)', 'Optional. See "How tolerance works" below.'],
          ['Start Date', 'The first day this goal is in effect. Leave blank if it has always applied.'],
          ['End Date', 'The last day this goal is in effect. Leave blank if the goal is still current (most goals).'],
          ['Active', 'A simple on/off switch. Unchecking it hides the goal from scorecards without deleting it.'],
        ],
      },

      { type: 'h2', text: 'How tolerance works behind the scenes' },
      {
        type: 'p',
        text:
          'Tolerance is the buffer around the goal value that still counts as **On Track**. Whether the buffer is added or subtracted depends on the **direction** of the metric (set in the Metrics section):',
      },
      {
        type: 'list',
        items: [
          'For "higher is better" metrics (like CSAT % or Call Accept %), the tolerance is **subtracted**. Goal 96% with a tolerance of 2% means anything **at or above 94%** is On Track.',
          'For "lower is better" metrics (like Average Resolution Time), the tolerance is **added**. Goal 5 days with a tolerance of 1 day means anything **at or below 6 days** is On Track.',
        ],
      },
      {
        type: 'table',
        headers: ['Metric', 'Goal', 'Tolerance', 'On Track when…'],
        rows: [
          ['CSAT %', '96%', '±2%', 'actual is 94% or higher'],
          ['Call Accept %', '85%', '±2%', 'actual is 83% or higher'],
          ['Attendance %', '95%', '±10%', 'actual is 85% or higher'],
          ['Avg Resolution Time', '5 days', '±1 day', 'actual is 6 days or fewer'],
          ['Articles Created', '3', '(none)', 'actual is 3 or more'],
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        text:
          'Tolerance is optional. If you leave it blank, the agent must hit the exact goal value (or better) to be On Track.',
      },
      { type: 'shot', id: 'HELP-004', caption: 'A scorecard showing Goal, Tolerance and On Track / Off Track status side by side.' },

      { type: 'h2', text: 'Changing a goal over time (mid-year changes)' },
      {
        type: 'p',
        text:
          'Targets sometimes change partway through the year. The tool keeps your history correct by letting each goal carry a **Start Date** and **End Date**, right down to the specific day.',
      },
      {
        type: 'p',
        text:
          'Example: CSAT was 94% from January, then raised to 96% starting 15 June. Use **+ Add Goal**, enter 96, set **Starts** to 15 June and leave the teams ticked. The 94% goal is ended on 14 June for you, automatically, for every team you ticked. Someone viewing a January–May scorecard still sees the 94% target they were judged against at the time; from mid-June onward they see 96%.',
      },
      {
        type: 'callout',
        variant: 'tip',
        text:
          'Because performance is reviewed monthly, try to start goals on the 1st of a month when you can. Changing a goal in the middle of a month means that single month is judged against whichever goal overlapped it.',
      },

      { type: 'h2', text: 'Editing a goal that already exists' },
      {
        type: 'steps',
        items: [
          'Click the value in the grid where that metric and team cross.',
          'Change any field and click **Save**.',
        ],
      },
      {
        type: 'callout',
        variant: 'warning',
        text:
          'Editing a goal changes it for **every month it has been running**, including months already reviewed. That is right when the figure was simply typed in wrong. If instead the target has genuinely moved, do not edit the old goal — use **+ Add Goal** with the new figure and a **Starts** date, which ends the old goal for you and leaves past reports alone.',
      },
      { type: 'shot', id: 'HELP-006', caption: 'Clicking a value in the grid opens that team’s goal.' },

      { type: 'h2', text: 'Stopping vs. deleting a goal' },
      {
        type: 'list',
        items: [
          '**Give it an End Date** (or untick **Active**) — the goal stops going forward but still counts for the months it was running, so past reports are untouched. This is almost always what you want.',
          '**Delete Goal** — removes it completely, including from past reports. It cannot be undone.',
        ],
      },

      { type: 'h2', text: 'When a cell shows a ⚠ warning' },
      {
        type: 'p',
        text:
          'A ⚠ means that team has **more than one goal running for the same metric at the same time**, so reports have no way of knowing which target to use. This is the kind of thing that quietly makes a scorecard wrong — it is exactly what went wrong on Billing.',
      },
      {
        type: 'steps',
        items: [
          'Click the ⚠ cell.',
          'A short list shows every goal that is running, and marks the one reports are currently using.',
          'Click **Edit** on the one that should not be running, and either give it an **End Date** or untick **Active**. Past reports stay as they were.',
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        text:
          'Clashes are prevented going forward: **+ Add Goal** always ends the running goal the day before the new one starts, and editing a goal by hand onto dates another goal already covers asks you first.',
      },

      { type: 'h2', text: 'Setting up a brand-new team' },
      {
        type: 'p',
        text:
          'Rather than adding goals one at a time for a new team, copy them from a team that already has the right ones. On the **Teams** page, when you add a team, use **Copy goals from** and pick an existing team. Every goal that team is running today is copied across, and the Goals page tells you it happened so you can adjust or end any that do not fit.',
      },
      {
        type: 'callout',
        variant: 'info',
        text:
          'Copying is offered only while creating a new team, so it can never overwrite goals a team already has.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'metrics',
    title: 'How to Use the Metrics Section',
    category: 'Setup',
    summary:
      'Define the things the tool tracks — what a metric is, the difference between scored and additional metrics, how to add one and what each field means, and how to retire a metric without losing its history.',
    blocks: [
      { type: 'h2', text: 'What a metric is, and why it matters' },
      {
        type: 'p',
        text:
          'A **metric** is a single thing you measure about performance — CSAT %, Call Accept %, Average Resolution Time, Articles Created, and so on. Metrics are the building blocks of every scorecard: each one shows the agent or team\'s actual result, and (if a goal exists) whether they are On Track.',
      },
      {
        type: 'p',
        text:
          'You define a metric **once** here in the Metrics section. After that, you can set a per-team target for it in the Goals section, and it will appear on the dashboards.',
      },
      { type: 'shot', id: 'HELP-007', caption: 'The Metrics page, with metrics grouped into Scored, Additional, and Inactive sections.' },

      { type: 'h2', text: 'Scored vs. additional metrics' },
      {
        type: 'p',
        text:
          'Every metric is either **scored** or **additional**, controlled by the "Counts Toward Score" switch:',
      },
      {
        type: 'list',
        items: [
          '**Scored metrics** count toward the agent\'s Overall Rating (Meets Expectations / Needs Improvement / Below Expectations). These are the metrics leadership holds the team accountable for.',
          '**Additional metrics** are shown for context and awareness but do **not** affect the Overall Rating. Use these for numbers you want visible but are not formally grading.',
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        text:
          'The Overall Rating is worked out as a percentage of scored metrics that are On Track: 100% On Track = Meets Expectations, 75–99% = Needs Improvement, below 75% = Below Expectations. Because it is a percentage, the rating stays correct even as you add or remove scored metrics.',
      },
      { type: 'shot', id: 'HELP-010', caption: 'The Scored Metrics and Additional Metrics sections on the Metrics page.' },

      { type: 'h2', text: 'Adding a metric — step by step' },
      {
        type: 'steps',
        items: [
          'Click the blue **+ Add Metric** button near the top of the page.',
          'Fill in each field in the pop-up (explained below).',
          'Click **Save**. The metric appears in the matching section.',
        ],
      },
      { type: 'shot', id: 'HELP-008', caption: 'The + Add Metric button.' },
      { type: 'shot', id: 'HELP-009', caption: 'The Add Metric pop-up with all of its fields.' },

      { type: 'h2', text: 'Every field explained' },
      {
        type: 'table',
        headers: ['Field', 'What it means'],
        rows: [
          ['Metric Name', 'The friendly name shown everywhere in the tool (e.g. "CSAT %").'],
          ['Key', 'A short internal code in snake_case (e.g. "csat_pct"). It links the metric to the underlying data, so it must be unique and is usually set once and left alone.'],
          ['Unit Type', 'How the number is displayed: Count, Percent, Days, or Hours.'],
          ['Direction Good', 'Which way is good. "At or Above" = higher is better (CSAT). "At or Below" = lower is better (Resolution Time). This also decides whether tolerance is subtracted or added.'],
          ['Display Order', 'Controls the order metrics appear in. Lower numbers show first.'],
          ['Counts Toward Score', 'On = scored metric (affects rating). Off = additional metric (shown only).'],
          ['Active', 'On = the metric is in use. Off = retired/hidden (see below).'],
        ],
      },
      { type: 'shot', id: 'HELP-011', caption: 'The Counts Toward Score and Active checkboxes in the metric pop-up.' },

      { type: 'h2', text: 'Making a metric inactive (retiring it)' },
      {
        type: 'p',
        text:
          'When a metric is no longer used, untick its **Active** switch instead of deleting it. An inactive metric:',
      },
      {
        type: 'list',
        items: [
          'Moves to the "Inactive Metrics" section on this page.',
          'Disappears from agent and team scorecards going forward.',
          'Drops out of the Overall Rating automatically — the rating recalculates against the metrics that remain.',
          'Keeps its history, so past months you already recorded are not lost.',
        ],
      },
      {
        type: 'callout',
        variant: 'tip',
        text:
          'Turning a metric off is the safe way to retire it. You can always turn it back on later and everything reappears exactly as before.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'agent-performance',
    title: 'How to Read the Agent Performance Page',
    category: 'Daily Use',
    summary:
      'The 1:1 view supervisors use most: pick a team and agent, read the Overall Rating, switch between Monthly / Quarterly / Half-Year / YTD / Trend, understand the goal vs. actual columns, and record a coaching note.',
    blocks: [
      { type: 'h2', text: 'What this page is for' },
      {
        type: 'p',
        text:
          'The **Agent Performance** page is the main screen used during a 1:1 between a supervisor and an agent. It shows one agent\'s scorecard, their Overall Rating, and how they are trending — everything needed for a monthly review in one place.',
      },

      { type: 'h2', text: 'Choosing what you are looking at' },
      {
        type: 'steps',
        items: [
          'Pick a **Team** from the filter bar. The agent list then shows only that team\'s agents.',
          'Pick an **Agent**.',
          'Pick the **Year** and **Month** you want to review.',
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        text:
          'These filter choices are remembered as you move between pages, so you do not have to re-select your team and agent every time.',
      },
      { type: 'shot', id: 'HELP-012', caption: 'The Agent Performance filter bar (Team, Agent, Year, Month).' },

      { type: 'h2', text: 'The Overall Rating' },
      {
        type: 'p',
        text:
          'At the top of the page you will see the agent\'s **Overall Rating** for the selected month, colour-coded so it is readable at a glance:',
      },
      {
        type: 'list',
        items: [
          '**Gold — Exceeds Expectations**',
          '**Green — Meets Expectations** (all scored metrics On Track)',
          '**Orange — Needs Improvement** (75–99% of scored metrics On Track)',
          '**Red — Below Expectations** (under 75% On Track)',
        ],
      },
      { type: 'shot', id: 'HELP-013', caption: 'The Overall Rating shown in the page header.' },

      { type: 'h2', text: 'The time-period tabs' },
      {
        type: 'p',
        text:
          'Use the tabs to change the period you are reviewing:',
      },
      {
        type: 'table',
        headers: ['Tab', 'Shows'],
        rows: [
          ['Monthly', 'The selected single month in full detail.'],
          ['Quarterly', 'Results grouped into the four quarters (Q1–Q4).'],
          ['Half-Year', 'Results grouped into the two halves (H1, H2).'],
          ['YTD', 'Year-to-date totals up to the selected month.'],
          ['Trend', 'A month-by-month view so you can see direction of travel.'],
        ],
      },
      { type: 'shot', id: 'HELP-014', caption: 'The Monthly / Quarterly / Half-Year / YTD / Trend tabs.' },

      { type: 'h2', text: 'Reading the scorecard columns' },
      {
        type: 'p',
        text:
          'For each metric the table shows the **actual** result alongside the **Goal**, the **Tolerance**, and an On Track / Off Track status. The goal shown is always the one that was in effect for the month you are viewing — so a backdated month correctly shows the target that applied back then, not today\'s target.',
      },
      {
        type: 'list',
        items: [
          '**On Track** (green) — the agent met the goal (within tolerance).',
          '**Off Track** (red) — the agent missed the goal.',
          '**No Goal** (grey) — no target is set for this metric/team, so it does not affect the rating.',
          '**No Data** (grey) — no result was recorded for this metric this month.',
        ],
      },
      { type: 'shot', id: 'HELP-015', caption: 'A monthly scorecard row showing Actual, Goal, Tolerance and Status.' },

      { type: 'h2', text: 'The Trend view' },
      {
        type: 'p',
        text:
          'The **Trend** tab lays out each metric across the recent months so you can quickly see whether an agent is improving, holding steady, or slipping over time.',
      },
      { type: 'shot', id: 'HELP-016', caption: 'The Trend tab showing month-by-month results per metric.' },

      { type: 'h2', text: 'Recording a coaching note' },
      {
        type: 'steps',
        items: [
          'Scroll to the **Supervisor Note** card for the selected month.',
          'Choose your name from the **Supervisor** dropdown.',
          'Type the note and click **Save Note**. The date and your name are saved with it.',
          'Use **Hide Notes / Show Notes** to hide the note section while screen-sharing with the agent if you do not want it visible.',
        ],
      },
      { type: 'shot', id: 'HELP-017', caption: 'The Supervisor Note card with the supervisor dropdown, Save Note, and Hide/Show toggle.' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'attendance',
    title: 'How to Use the Attendance Page',
    category: 'Daily Use',
    summary:
      'Record daily attendance: choose a month, fill in a single cell, or use the bulk tools to apply a code to many agents and dates at once — including marking a holiday for the whole team.',
    blocks: [
      { type: 'h2', text: 'What this page is for' },
      {
        type: 'p',
        text:
          'The **Attendance Entry** page is a grid of agents (rows) against the days of the month (columns). You record each agent\'s status per day using short codes — for example **P** (present), **A** (absent), **PTO**, and **H** (holiday).',
      },

      { type: 'h2', text: 'Choosing the month' },
      {
        type: 'p',
        text:
          'Use the **Year** and **Month** dropdowns at the top to load the grid for the period you want. Inactive agents are hidden by default; tick **Show inactive** if you need them.',
      },
      { type: 'shot', id: 'HELP-018', caption: 'The attendance grid with the Year and Month selectors.' },

      { type: 'h2', text: 'Filling in a single day for one agent' },
      {
        type: 'steps',
        items: [
          'Make sure no agent checkboxes are ticked (this keeps you in single-cell mode).',
          'Click the cell where the agent\'s row meets the day\'s column.',
          'Pick the code in the small pop-up. The cell updates straight away.',
        ],
      },
      { type: 'shot', id: 'HELP-019', caption: 'Clicking a single cell to set one agent\'s code for one day.' },

      { type: 'h2', text: 'Applying a code to many agents and days at once' },
      {
        type: 'p',
        text:
          'When you need to set the same code for several agents and/or several days, use bulk mode:',
      },
      {
        type: 'steps',
        items: [
          'Tick the checkbox next to each agent you want to include.',
          'Click cells in the grid to select the date columns — selected dates highlight. (Tip: click a **week header** to select that whole week at once.)',
          'Choose the code and click **Apply to Selected Cells**. It fills every selected agent/date combination.',
        ],
      },
      {
        type: 'callout',
        variant: 'tip',
        text:
          'Once one or more agents are ticked, clicking a cell selects its date instead of opening the single-cell pop-up. If you only see the pop-up, it means no agents are ticked.',
      },
      { type: 'shot', id: 'HELP-020', caption: 'Bulk mode: agents ticked on the left and date columns highlighted.' },
      { type: 'shot', id: 'HELP-021', caption: 'Clicking a week header to select an entire week.' },

      { type: 'h2', text: 'Marking a holiday for the whole team' },
      {
        type: 'p',
        text:
          'For an observed holiday, use the holiday panel. It applies the **H** code (the tool standardises on H):',
      },
      {
        type: 'list',
        items: [
          '**Apply to all agents** — marks the holiday for every agent shown.',
          '**Apply to selected** — marks the holiday only for the agents you have ticked. (This button is greyed out until at least one agent is ticked.)',
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        text:
          'For a one-off observed day that is not in the default holiday list (for example an EQX holiday), just select the date column(s) in the grid and apply the H code in bulk.',
      },
      { type: 'shot', id: 'HELP-022', caption: 'The holiday panel with Apply to all agents and Apply to selected.' },

      { type: 'h2', text: 'Clearing entries' },
      {
        type: 'p',
        text:
          'To remove entries in bulk, tick the agents, select the date cells, and click **Clear Selected Cells**. This empties those cells (removing saved entries as well as ones you have not saved yet).',
      },
      { type: 'shot', id: 'HELP-023', caption: 'The Clear Selected Cells button.' },

      {
        type: 'callout',
        variant: 'info',
        text:
          'Attendance is saved to the database and will still be there when you come back in a later session.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'agents',
    title: 'How to Manage Agents',
    category: 'Setup',
    summary:
      'Add and maintain agent profiles: set their role and reporting supervisor, assign them to teams, record hire / go-live / employment end dates, and understand how active vs. inactive affects the dashboards.',
    blocks: [
      { type: 'h2', text: 'What this page is for' },
      {
        type: 'p',
        text:
          'The **Agents** page (under People & Assignment) is where every person tracked by the tool is set up. The header shows a running count of total, active, and inactive agents.',
      },
      { type: 'shot', id: 'HELP-024', caption: 'The Agents list with the Search box and Status filter.' },

      { type: 'h2', text: 'Finding an agent' },
      {
        type: 'list',
        items: [
          'Use the **Search** box to filter by name.',
          'Use the **Status** dropdown to show All, Active only, or Inactive only.',
        ],
      },

      { type: 'h2', text: 'Adding a new agent' },
      {
        type: 'steps',
        items: [
          'Click **+ Add Agent** in the top-right.',
          'Fill in the fields in the pop-up (explained below).',
          'Click **Save**.',
        ],
      },
      { type: 'shot', id: 'HELP-025', caption: 'The + Add Agent button.' },
      { type: 'shot', id: 'HELP-026', caption: 'The agent profile pop-up with all of its fields.' },

      { type: 'h2', text: 'Every field explained' },
      {
        type: 'table',
        headers: ['Field', 'What it means'],
        rows: [
          ['Agent Name', 'The person\'s name as it appears throughout the tool.'],
          ['Role', 'Their role: Support Specialist, PSA, Client Advocate Tier I, Client Advocate Tier II, Team Lead, Supervisor, Manager, Trainer, or Other.'],
          ['Reporting Supervisor/Team Lead', 'Who this agent reports to. The list is drawn from active people whose role is Supervisor or Team Lead, with supervisors shown first and each name followed by its role. Setting this is what makes the agent appear under that person in the Reporting Supervisor/Team Lead filter on Team Assignments.'],
          ['Hire Date', 'When the agent was hired.'],
          ['Go-Live Date', 'When the agent started taking live work (used so brand-new agents are not judged on ramp-up time).'],
          ['Employment End Date', 'Their last day, if known. See below — this auto-deactivates the agent when the date passes.'],
          ['Notes', 'Free text for anything useful about the agent.'],
          ['Active', 'Whether the agent currently appears on the dashboards.'],
        ],
      },

      { type: 'h2', text: 'The Employment End Date field' },
      {
        type: 'p',
        text:
          'Setting an **Employment End Date** lets the tool retire an agent automatically:',
      },
      {
        type: 'list',
        items: [
          'If the date is in the **past**, the agent is marked inactive right away when you save.',
          'If the date is in the **future**, the agent stays active until that day, then is automatically switched to inactive (the check runs whenever the app is opened).',
          'Their historical data is preserved, so past months still show their results.',
        ],
      },
      { type: 'shot', id: 'HELP-027', caption: 'The Employment End Date field on the agent profile.' },

      { type: 'h2', text: 'Active vs. inactive' },
      {
        type: 'p',
        text:
          'The **Active** switch controls visibility. Active agents appear on the Agent Performance, Team Dashboard, and Attendance pages. Inactive agents are hidden from those dashboards but keep all of their history, so nothing is lost — you are just tidying up the everyday views.',
      },

      { type: 'h2', text: 'Assigning an agent to teams' },
      {
        type: 'p',
        text:
          'Once an agent has been saved, a **Team Assignments** section appears at the bottom of their profile. An agent can belong to more than one team.',
      },
      {
        type: 'steps',
        items: [
          'Open the agent\'s profile (it must already be saved).',
          'In the Team Assignments section, pick a team under **Add Team**.',
          'Optionally enter the month it takes effect (format YYYY-MM, e.g. 2026-01).',
          'Click **Add**. To remove an assignment, click **Remove** next to it.',
        ],
      },
      { type: 'shot', id: 'HELP-028', caption: 'The Team Assignments section at the bottom of the agent profile.' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'notes',
    title: 'How to Use Supervisor Notes',
    category: 'Daily Use',
    summary:
      'Record a coaching note during a 1:1, hide it while screen-sharing with the agent, and manage all notes across the team from the Admin Notes section.',
    blocks: [
      { type: 'h2', text: 'What supervisor notes are for' },
      {
        type: 'p',
        text:
          'A **supervisor note** is a private coaching record attached to a specific agent and month. It lets the supervisor capture what was discussed, any action items, or observed patterns — right alongside the scorecard — without the agent seeing it during the review.',
      },
      {
        type: 'p',
        text:
          'Notes are written in the **Agent Performance** page during (or after) the 1:1. They can also be added, edited, or browsed in bulk from the **Admin Notes** section (Metric Setup → Notes).',
      },

      { type: 'h2', text: 'Writing a note during a 1:1' },
      {
        type: 'steps',
        items: [
          'Open the **Agent Performance** page and select the agent and month you are reviewing.',
          'Scroll down to the **Supervisor Note** card below the scorecard.',
          'Choose your name from the **Supervisor** dropdown.',
          'Type the coaching note in the text area.',
          'Click **Save Note**. The note is saved immediately with your name and the date.',
        ],
      },
      { type: 'shot', id: 'HELP-029', caption: 'The full Supervisor Note card on the Agent Performance page.' },
      { type: 'shot', id: 'HELP-030', caption: 'The Supervisor dropdown inside the note card — pick your name before saving.' },

      { type: 'h2', text: 'Hiding the note while screen-sharing' },
      {
        type: 'p',
        text:
          'If you are sharing your screen with the agent during the review, you may not want the coaching note visible. Use the **Hide Notes / Show Notes** toggle at the top of the Supervisor Note card to collapse the section.',
      },
      {
        type: 'list',
        items: [
          'Click **Hide Notes** — the note collapses and the toggle label changes to **Show Notes**.',
          'Click **Show Notes** again when you want to bring it back.',
          'The note itself is not deleted — it is just hidden on screen.',
        ],
      },
      {
        type: 'callout',
        variant: 'tip',
        text:
          'Hide the note before you share your screen with the agent, then reveal it again after the call to review or update it.',
      },
      { type: 'shot', id: 'HELP-031', caption: 'The Hide Notes / Show Notes toggle button on the note card.' },

      { type: 'h2', text: 'Managing notes in the Admin Notes section' },
      {
        type: 'p',
        text:
          'Go to **Metric Setup → Notes** in the sidebar to see every coaching note across all agents and months in one table. This is useful for managers who want to review what supervisors have written, or to fix a note added under the wrong agent or month.',
      },
      { type: 'shot', id: 'HELP-032', caption: 'The Admin Notes page showing all notes across agents and months.' },

      { type: 'h2', text: 'Filtering notes' },
      {
        type: 'list',
        items: [
          '**Agent** — filter to see only notes for one specific agent.',
          '**Month** — filter to see only notes recorded for a particular month.',
          'Leave both filters blank to see everything.',
        ],
      },

      { type: 'h2', text: 'Adding or editing a note from the Admin section' },
      {
        type: 'steps',
        items: [
          'To add: click **+ Add Note** in the top-right. Select the Agent, Month, type the note, and pick the supervisor from the Created By dropdown.',
          'To edit: click **Edit** on any row. Change the note text or any other field and click **Save**.',
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        text:
          'The Created By field uses the supervisor list from the Agents section (anyone with the Supervisor role). If a name is missing from the dropdown, check that the person is set up as an agent with the Supervisor role.',
      },
      { type: 'shot', id: 'HELP-033', caption: 'The Add/Edit Note pop-up with the Agent, Month, Note, and Created By fields.' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'teams',
    title: 'How to Manage Teams and Team Assignments',
    category: 'Setup',
    summary:
      'Create support teams, set their display order and active status, then assign agents to a team with effective date ranges so scorecards always show the right team membership.',
    blocks: [
      { type: 'h2', text: 'Teams vs. Team Assignments — what is the difference?' },
      {
        type: 'list',
        items: [
          '**Teams** (Admin → People & Assignment → Teams) — defines a team: its name, its short internal key, and whether it is active.',
          '**Team Assignments** (Admin → People & Assignment → Team Assignments) — links a specific agent to a specific team, with optional start and end months so you can track team changes over time.',
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        text:
          'You must create the team first, then assign agents to it. An agent can belong to more than one team at the same time if their role spans teams.',
      },

      { type: 'h2', text: 'Creating a new team' },
      {
        type: 'steps',
        items: [
          'Go to **People & Assignment → Teams** in the sidebar.',
          'Click **+ Add Team**.',
          'Fill in the fields (explained below) and click **Save**.',
        ],
      },
      { type: 'shot', id: 'HELP-034', caption: 'The Teams page listing all teams.' },
      { type: 'shot', id: 'HELP-035', caption: 'The + Add Team button at the top of the Teams page.' },
      { type: 'shot', id: 'HELP-036', caption: 'The Add Team pop-up with all of its fields.' },

      { type: 'h2', text: 'Team fields explained' },
      {
        type: 'table',
        headers: ['Field', 'What it means'],
        rows: [
          ['Team Name', 'The display name shown throughout the tool (e.g. "Billing", "CRM", "Implementations").'],
          ['Key', 'A short internal code in snake_case (e.g. "billing", "crm"). Used internally to link data — keep it short, lowercase, and unique. Once set, avoid changing it.'],
          ['Display Order', 'Controls the order teams appear in dropdowns and dashboards. Lower numbers appear first.'],
          ['Active', 'Untick this to hide the team from all dropdowns and dashboards. All existing data is preserved.'],
        ],
      },

      { type: 'h2', text: 'Making a team inactive' },
      {
        type: 'p',
        text:
          'If a team is dissolved or restructured, untick its **Active** switch rather than deleting it. The team disappears from all dropdowns, but all historical scorecard data is preserved. You can reactivate it at any time.',
      },
      {
        type: 'callout',
        variant: 'warning',
        text:
          'If you delete a team rather than deactivating it, any agent assignments and goals linked to that team will be broken. Always deactivate instead of delete.',
      },

      { type: 'h2', text: 'Assigning an agent to a team' },
      {
        type: 'p',
        text:
          'Team Assignments link agents to teams. Each assignment can carry **Start** and **End** months so the tool knows exactly which team an agent belonged to for each month — this matters for scorecard history.',
      },
      {
        type: 'steps',
        items: [
          'Go to **People & Assignment → Team Assignments**.',
          'Click **+ Add Assignment**.',
          'Select the **Agent** and **Team** from the dropdowns.',
          'Enter a **Start Month** (format YYYY-MM, e.g. 2026-01) if you know when the agent joined the team. Leave blank if it has always applied.',
          'Enter an **End Month** only if the agent has already left that team. Leave blank if they are still on it.',
          'Make sure **Active** is ticked, then click **Save**.',
        ],
      },
      { type: 'shot', id: 'HELP-037', caption: 'The Team Assignments page with the Agent and Team filters.' },
      { type: 'shot', id: 'HELP-038', caption: 'The Add Assignment pop-up (Agent, Team, Start Month, End Month, Active).' },

      { type: 'h2', text: 'Using the filters on the Team Assignments page' },
      {
        type: 'list',
        items: [
          '**Agent** filter — show only assignments for one agent. Useful when checking which teams an agent belongs to.',
          '**Team** filter — show only assignments for one team. Useful when checking who is on the team.',
          'Leave both blank to see every assignment in the system.',
        ],
      },

      { type: 'h2', text: 'A quicker way to assign teams from the agent profile' },
      {
        type: 'p',
        text:
          'You can also manage team assignments directly from an agent\'s profile. Open the agent in **People & Assignment → Agents**, scroll to the **Team Assignments** section at the bottom of the profile, pick a team, enter the start month, and click **Add**. See the "How to Manage Agents" article for more detail.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'attendance-summary',
    title: 'How to Read the Attendance Summary Page',
    category: 'Daily Use',
    summary:
      'The Attendance Summary page gives a quick, calculated view of each agent\'s attendance percentage for a selected month — so you can see attendance health at a glance without opening the full entry grid.',
    blocks: [
      { type: 'h2', text: 'What this page is for' },
      {
        type: 'p',
        text:
          'The **Attendance Summary** page (under Attendance in the sidebar) shows a single number per agent for a given month: their **attendance percentage**, calculated from the daily codes that have been entered in the Attendance Entry grid.',
      },
      {
        type: 'p',
        text:
          'Use it to quickly check team-wide attendance health, spot agents who are trending low, and report on a month without having to scroll through the full day-by-day grid.',
      },
      { type: 'shot', id: 'HELP-039', caption: 'The full Attendance Summary page.' },

      { type: 'h2', text: 'Attendance Summary vs. Attendance Entry — what is the difference?' },
      {
        type: 'table',
        headers: ['Page', 'What you do there'],
        rows: [
          ['Attendance Entry', 'Record attendance day by day (P, A, PTO, H, etc.). This is where data is entered and changed.'],
          ['Attendance Summary', 'Read the calculated attendance percentage per agent for a month. Read-only — you cannot edit data here.'],
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        text:
          'If the summary looks wrong, go to Attendance Entry to check or correct the daily codes for that agent and month.',
      },

      { type: 'h2', text: 'Choosing the month and team' },
      {
        type: 'p',
        text:
          'Use the filter bar at the top to control what you are looking at:',
      },
      {
        type: 'list',
        items: [
          '**Month** — select the month you want to review. The dropdown shows the last 18 months.',
          '**Team** — narrow the list to one team. Leave on "All Teams" to see every agent.',
        ],
      },
      { type: 'shot', id: 'HELP-040', caption: 'The Attendance Summary filter bar — Month and Team selectors.' },

      { type: 'h2', text: 'Reading the summary table' },
      {
        type: 'table',
        headers: ['Column', 'What it means'],
        rows: [
          ['Agent', 'The agent\'s name.'],
          ['Scheduled Days', 'The number of working days the agent was expected to be present (excluding weekends, holidays, and PTO).'],
          ['Available Days', 'The number of days the agent was actually present (coded as P or available).'],
          ['Attendance %', 'Available Days ÷ Scheduled Days × 100. Colour-coded: green (90% +), amber (80–89%), red (below 80%).'],
        ],
      },
      { type: 'shot', id: 'HELP-041', caption: 'The summary table showing Agent, Scheduled Days, Available Days, and colour-coded Attendance %.' },

      { type: 'h2', text: 'What the colours mean' },
      {
        type: 'list',
        items: [
          '**Green** — attendance is 90% or above.',
          '**Amber** — attendance is 80–89%, worth monitoring.',
          '**Red** — attendance is below 80%, likely needs attention.',
          '**Grey dash (—)** — no attendance data has been entered for this agent yet. Go to Attendance Entry to add records.',
        ],
      },
      {
        type: 'callout',
        variant: 'tip',
        text:
          'Run a quick check at the start of each month to make sure the previous month\'s data is fully entered before sharing reports with leadership.',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'metric-adjustments',
    title: 'How to Use Metric Adjustments (Custom Goals & Exclusions)',
    category: 'Daily Use',
    summary:
      'Give one agent a custom goal for a month (new hires, PIPs) or exclude a metric that shouldn\'t count against them (e.g. an unfair CSAT) — with a required reason and full tracking.',
    blocks: [
      { type: 'h2', text: 'What metric adjustments are for' },
      {
        type: 'p',
        text:
          'Team goals don\'t always fit an individual\'s situation. **Metric adjustments** let a manager make a per-agent exception for a single month, in two ways:',
      },
      {
        type: 'list',
        items: [
          '**Custom goal** — a new hire or an agent on a PIP is measured against their own ramp-up goal instead of the team default (for example, 80% instead of 95%).',
          '**Exclude a metric** — a result that wasn\'t the agent\'s fault (a bad CSAT on a mishandled ticket, a tech outage) is dropped from their score for that month.',
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        text:
          'An adjustment affects **only that agent, for that month**. Team goals and every other agent\'s scorecard are untouched.',
      },

      { type: 'h2', text: 'Making an adjustment — step by step' },
      {
        type: 'steps',
        items: [
          'Go to **Agent Performance** and select the team, agent, and month.',
          'Find the metric you want to adjust — every row has an **Adjust** button on the right.',
          'In the pop-up, choose **Custom goal** (enter the goal, and optionally a tolerance) or **Exclude this metric from the score this month**.',
          'Type the **reason** — this is required, so the record always explains itself.',
          'Pick your name under **Adjusted By** and click **Save Adjustment**.',
        ],
      },
      { type: 'shot', id: 'HELP-042', caption: 'The Adjust button at the end of each metric row on Agent Performance.' },
      { type: 'shot', id: 'HELP-043', caption: 'The Adjust pop-up with the custom goal and exclude options, reason, and Adjusted By.' },

      { type: 'h2', text: 'What you\'ll see after saving' },
      {
        type: 'list',
        items: [
          'A **custom goal** shows a purple **custom goal** tag on the row, and On Track / Off Track is judged against the new goal.',
          'An **excluded** metric turns grey with an **Excluded** label and drops out of the agent\'s Overall Rating.',
          'Hover over the tag or the Excluded label to see the reason and who made the adjustment.',
          'The **Overall Rating / On Track / Off Track** cards at the top update automatically.',
        ],
      },

      { type: 'h2', text: 'Changing or removing an adjustment' },
      {
        type: 'p',
        text:
          'Open the same pop-up — the button reads **Edit** on an adjusted row. Change the details and save, or click **Remove Adjustment** to restore the team default.',
      },

      { type: 'h2', text: 'Tracking every adjustment' },
      {
        type: 'p',
        text:
          'Go to **Metric Setup → Notes**. Below the supervisor notes is a **Metric Adjustments** table listing every adjustment — agent, month, metric, what changed, the reason, and who made it. Use the Agent and Month filters to narrow it down.',
      },
      { type: 'shot', id: 'HELP-044', caption: 'The Metric Adjustments table on the Notes page.' },

      { type: 'h2', text: 'Good to know' },
      {
        type: 'list',
        items: [
          'Adjustments apply **one month at a time** — for a 90-day PIP, set the custom goal on each of the three months.',
          'Adjustments currently affect the **Monthly view** and that month\'s rating. The Quarterly / Half-Year / YTD tabs don\'t reflect them yet (planned as APT-128).',
          'Behind the scenes the adjustment is stored with that agent\'s monthly note, so it travels with the month it belongs to.',
        ],
      },
    ],
  },
]

// Master list of every screenshot placeholder — used to generate the CSV checklist
// and so each placeholder has a human-readable description in one place.
export const HELP_SCREENSHOTS = [
  { id: 'HELP-001', article: 'How to Use the Goals Section', shows: 'The full Goals page', highlight: 'The whole grid — metrics down the side, teams across the top' },
  { id: 'HELP-002', article: 'How to Use the Goals Section', shows: 'Top-right of the Goals page', highlight: 'Point an arrow at the blue "+ Add Goal" button' },
  { id: 'HELP-003', article: 'How to Use the Goals Section', shows: 'The Add Goal pop-up (open it, pick CSAT %)', highlight: 'Show the team checklist with the "now 96%" / "no goal" notes beside each team' },
  { id: 'HELP-004', article: 'How to Use the Goals Section', shows: 'An agent or team scorecard row', highlight: 'Highlight the Goal, Tolerance and On Track/Off Track columns together' },
  { id: 'HELP-006', article: 'How to Use the Goals Section', shows: 'The Edit Goal pop-up on an existing goal', highlight: 'Point to the red "Delete Goal" button at bottom-left' },
  { id: 'HELP-007', article: 'How to Use the Metrics Section', shows: 'The full Metrics page', highlight: 'Show the Scored / Additional / Inactive section headings' },
  { id: 'HELP-008', article: 'How to Use the Metrics Section', shows: 'Top of the Metrics page', highlight: 'Point an arrow at the "+ Add Metric" button' },
  { id: 'HELP-009', article: 'How to Use the Metrics Section', shows: 'The Add Metric pop-up (open it)', highlight: 'All fields visible: Metric Name, Key, Unit Type, Direction Good, Display Order' },
  { id: 'HELP-010', article: 'How to Use the Metrics Section', shows: 'The Metrics page', highlight: 'Highlight the Scored Metrics vs Additional Metrics sections' },
  { id: 'HELP-011', article: 'How to Use the Metrics Section', shows: 'Lower part of the Add/Edit Metric pop-up', highlight: 'Point to the "Counts Toward Score" and "Active" checkboxes' },
  { id: 'HELP-012', article: 'How to Read the Agent Performance Page', shows: 'The Agent Performance filter bar', highlight: 'Highlight Team, Agent, Year, Month selectors' },
  { id: 'HELP-013', article: 'How to Read the Agent Performance Page', shows: 'The page header', highlight: 'Point to the colour-coded Overall Rating' },
  { id: 'HELP-014', article: 'How to Read the Agent Performance Page', shows: 'The tab row', highlight: 'Highlight Monthly / Quarterly / Half-Year / YTD / Trend tabs' },
  { id: 'HELP-015', article: 'How to Read the Agent Performance Page', shows: 'A monthly scorecard row', highlight: 'Highlight the Actual, Goal, Tolerance, and Status columns' },
  { id: 'HELP-016', article: 'How to Read the Agent Performance Page', shows: 'The Trend tab open', highlight: 'Show the month-by-month grid for each metric' },
  { id: 'HELP-017', article: 'How to Read the Agent Performance Page', shows: 'The Supervisor Note card', highlight: 'Highlight the Supervisor dropdown, Save Note, and Hide/Show Notes toggle' },
  { id: 'HELP-018', article: 'How to Use the Attendance Page', shows: 'The Attendance Entry grid', highlight: 'Highlight the Year and Month dropdowns at the top' },
  { id: 'HELP-019', article: 'How to Use the Attendance Page', shows: 'A single cell being edited', highlight: 'Show the code pop-up that appears when clicking one cell (no agents ticked)' },
  { id: 'HELP-020', article: 'How to Use the Attendance Page', shows: 'Bulk mode in action', highlight: 'Show ticked agent checkboxes on the left and highlighted date columns' },
  { id: 'HELP-021', article: 'How to Use the Attendance Page', shows: 'The week header row', highlight: 'Point to a week header that selects the whole week' },
  { id: 'HELP-022', article: 'How to Use the Attendance Page', shows: 'The holiday panel', highlight: 'Point to "Apply to all agents" and "Apply to selected" buttons' },
  { id: 'HELP-023', article: 'How to Use the Attendance Page', shows: 'The bulk action buttons', highlight: 'Point to the red "Clear Selected Cells" button' },
  { id: 'HELP-024', article: 'How to Manage Agents', shows: 'The Agents list page', highlight: 'Highlight the Search box and Status filter' },
  { id: 'HELP-025', article: 'How to Manage Agents', shows: 'Top-right of the Agents page', highlight: 'Point to the "+ Add Agent" button' },
  { id: 'HELP-026', article: 'How to Manage Agents', shows: 'The agent profile pop-up (open it)', highlight: 'Show all fields: Name, Role, Reporting Supervisor/Team Lead, Hire Date, Go-Live Date, Employment End Date, Notes, Active' },
  { id: 'HELP-027', article: 'How to Manage Agents', shows: 'The agent profile pop-up', highlight: 'Point specifically to the Employment End Date field and its helper text' },
  { id: 'HELP-028', article: 'How to Manage Agents', shows: 'Bottom of a saved agent profile', highlight: 'Highlight the Team Assignments section with Add Team / Add' },
  { id: 'HELP-029', article: 'How to Use Supervisor Notes', shows: 'The Supervisor Note card on the Agent Performance page', highlight: 'Show the full note card including the text area, Supervisor dropdown, and Save Note button' },
  { id: 'HELP-030', article: 'How to Use Supervisor Notes', shows: 'The Supervisor dropdown inside the note card', highlight: 'Show the dropdown open with supervisor names listed' },
  { id: 'HELP-031', article: 'How to Use Supervisor Notes', shows: 'The Hide Notes / Show Notes toggle', highlight: 'Point to the toggle button at the top of the Supervisor Note card' },
  { id: 'HELP-032', article: 'How to Use Supervisor Notes', shows: 'The Admin Notes page (Metric Setup → Notes)', highlight: 'Show the full table: Agent, Month, Note, Created By columns and the + Add Note button' },
  { id: 'HELP-033', article: 'How to Use Supervisor Notes', shows: 'The Add/Edit Note pop-up', highlight: 'All fields visible: Agent, Month, Note text area, Created By dropdown' },
  { id: 'HELP-034', article: 'How to Manage Teams and Team Assignments', shows: 'The Teams page listing all teams', highlight: 'Show Team Name, Key, Display Order, Active columns' },
  { id: 'HELP-035', article: 'How to Manage Teams and Team Assignments', shows: 'Top of the Teams page', highlight: 'Point to the "+ Add Team" button' },
  { id: 'HELP-036', article: 'How to Manage Teams and Team Assignments', shows: 'The Add Team pop-up (open it)', highlight: 'All fields visible: Team Name, Key, Display Order, Active checkbox' },
  { id: 'HELP-037', article: 'How to Manage Teams and Team Assignments', shows: 'The Team Assignments page', highlight: 'Show the Agent and Team filter dropdowns and the assignments table' },
  { id: 'HELP-038', article: 'How to Manage Teams and Team Assignments', shows: 'The Add Assignment pop-up (open it)', highlight: 'All fields visible: Agent, Team, Start Month, End Month, Active checkbox' },
  { id: 'HELP-039', article: 'How to Read the Attendance Summary Page', shows: 'The full Attendance Summary page', highlight: 'Show the complete page including filter bar and the summary table' },
  { id: 'HELP-040', article: 'How to Read the Attendance Summary Page', shows: 'The Attendance Summary filter bar', highlight: 'Highlight the Month and Team selectors' },
  { id: 'HELP-041', article: 'How to Read the Attendance Summary Page', shows: 'The Attendance Summary table', highlight: 'Highlight Agent, Scheduled Days, Available Days, and Attendance % columns — show colour-coded percentage values' },
  { id: 'HELP-042', article: 'How to Use Metric Adjustments (Custom Goals & Exclusions)', shows: 'A monthly scorecard row on Agent Performance', highlight: 'Point to the Adjust button at the end of the row' },
  { id: 'HELP-043', article: 'How to Use Metric Adjustments (Custom Goals & Exclusions)', shows: 'The Adjust pop-up (open it on any metric)', highlight: 'All fields visible: Custom goal / Exclude options, Goal, Tolerance, Reason, Adjusted By' },
  { id: 'HELP-044', article: 'How to Use Metric Adjustments (Custom Goals & Exclusions)', shows: 'Metric Setup → Notes page', highlight: 'Highlight the Metric Adjustments table below the Supervisor Notes section' },
]
