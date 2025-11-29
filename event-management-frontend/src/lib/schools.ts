// Hard-coded school/branch taxonomy used for form selection.
export interface SchoolBranch {
  school: string;
  branches: string[];
}

export const SCHOOL_BRANCHES: SchoolBranch[] = [
  {
    school: 'School of Computer Science and Engineering',
    branches: [
      'Computer Science and Engineering',
      'Information Technology',
      'Artificial Intelligence and Machine Learning',
      'Data Science',
      'Cyber Security',
    ],
  },
  {
    school: 'School of Electronics and Electrical Engineering',
    branches: [
      'Electronics and Communication Engineering',
      'Electrical and Electronics Engineering',
      'Robotics and Automation',
      'Embedded Systems',
    ],
  },
  {
    school: 'School of Business and Management',
    branches: [
      'Finance',
      'Marketing',
      'Operations Management',
      'Human Resources',
      'Business Analytics',
    ],
  },
  {
    school: 'School of Humanities and Sciences',
    branches: [
      'Mathematics',
      'Physics',
      'Chemistry',
      'English',
      'Psychology',
    ],
  },
];

export const DEFAULT_SCHOOL = SCHOOL_BRANCHES[0]?.school ?? '';

// Return branch options to populate select menus.
export function getBranchesForSchool(school: string): string[] {
  const match = SCHOOL_BRANCHES.find((entry) => entry.school === school);
  return match ? match.branches : [];
}

// Quickly list every school configured in the catalog.
export function getAllSchools(): string[] {
  return SCHOOL_BRANCHES.map((entry) => entry.school);
}
