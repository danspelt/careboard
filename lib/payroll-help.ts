export type PayrollHelpRole = 'manager' | 'worker';

export type PayrollFaqItem = { id: string; question: string; answer: string };

export type PayrollAskStep = {
  id: string;
  question: string;
  detail: string;
  /** Optional field to collect on this step (manager setup only). */
  field?: 'bookkeeperEmail';
};

/** First-open payroll questionnaire for managers and care workers. */
export function payrollAskQuestions(role: PayrollHelpRole): PayrollAskStep[] {
  if (role === 'manager') {
    return [
      {
        id: 'bookkeeper',
        question: 'Who should receive the payroll CSV?',
        detail: 'Enter your bookkeeper’s email so CareBoard can send the two-week report. You can change this later in Settings.',
        field: 'bookkeeperEmail',
      },
      {
        id: 'rates',
        question: 'Have you set hourly rates for each care worker?',
        detail: 'Open a worker’s profile from Team and set their hourly pay rate. Rates appear on the CSV and estimated totals.',
      },
      {
        id: 'export',
        question: 'Ready to hand hours to payroll?',
        detail: 'Workers clock in on Today. You download or email the payroll CSV from Settings — CareBoard tracks hours; your bookkeeper or payroll software issues pay.',
      },
    ];
  }
  return [
    {
      id: 'clock-in',
      question: 'Do you know how to clock in?',
      detail: 'On Today, use Clock in when your shift starts and Clock out when it ends. Those hours feed your pay estimate and the household payroll report.',
    },
    {
      id: 'estimate',
      question: 'Where do you see hours and pay?',
      detail: 'Open More → Your pay for your rate (set by your manager), hours this month, and an estimated total. Estimates are not a paycheck.',
    },
    {
      id: 'paycheck',
      question: 'Does CareBoard pay you?',
      detail: 'No. CareBoard records hours for your manager and bookkeeper. Actual pay, deductions, and tax forms come from them or their payroll software.',
    },
  ];
}

/** In-app FAQ on payroll surfaces. */
export function payrollFaq(role: PayrollHelpRole): PayrollFaqItem[] {
  if (role === 'manager') {
    return [
      {
        id: 'what-csv',
        question: 'What is in the payroll CSV?',
        answer: 'Each care worker’s clock-ins by day for the date range you choose — hours, hourly rate when set, gross amounts, and totals — ready for a bookkeeper.',
      },
      {
        id: 'set-rate',
        question: 'How do I set a care worker’s pay rate?',
        answer: 'Open Team, choose the worker, edit their profile, and enter the hourly pay rate. Missing rates still export hours but leave pay columns blank.',
      },
      {
        id: 'bookkeeper',
        question: 'How does bookkeeper email work?',
        answer: 'Save a bookkeeper email in Settings. Use Email to bookkeeper on the payroll report to send the CSV for the selected pay period.',
      },
      {
        id: 'not-payroll-software',
        question: 'Does CareBoard run payroll?',
        answer: 'No. It supplies hours and rates for your bookkeeper or payroll software. Deductions, net pay, remittances, and T4s stay outside CareBoard.',
      },
    ];
  }
  return [
    {
      id: 'clock',
      question: 'How do my hours get recorded?',
      answer: 'Clock in and out from Today. Open shifts count live; finished entries roll into your monthly hours and the manager’s payroll report.',
    },
    {
      id: 'rate',
      question: 'Who sets my pay rate?',
      answer: 'Your household manager sets it on your profile. If it says “Not set,” ask them — only they can change it.',
    },
    {
      id: 'estimate',
      question: 'Is estimated pay my paycheck?',
      answer: 'No. It multiplies your clocked hours by your rate for a rough total. Official pay comes from your manager or their bookkeeper.',
    },
    {
      id: 'privacy',
      question: 'Can other care workers see my pay?',
      answer: 'No. You only see your own rate and hours. Other workers’ pay stays private.',
    },
  ];
}

/** Suggested Assistant chips — process questions only (assistant never receives pay amounts). */
export function payrollAssistantPrompts(role: PayrollHelpRole): string[] {
  if (role === 'manager') {
    return [
      'How do I send a payroll report to my bookkeeper?',
      'Where do I set care worker hourly rates?',
      'What does the payroll CSV include?',
    ];
  }
  return [
    'How do I clock in for my shift?',
    'Where can I see my hours and pay estimate?',
    'Does CareBoard issue my paycheck?',
  ];
}

export function assistantPayrollSuggestions(role: string): string[] {
  if (role === 'manager' || role === 'worker') return payrollAssistantPrompts(role);
  return [];
}

export function payrollAskStorageKey(memberId: string) {
  return `careboard-payroll-ask-${memberId}`;
}
