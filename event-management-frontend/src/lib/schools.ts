// Hard-coded school/branch taxonomy used for form selection.
export interface SchoolBranch {
  school: string;
  branches: string[];
}

export const SCHOOL_BRANCHES: SchoolBranch[] = [
  {
    school: 'Manipal Institute of Technology',
    branches: [
      'School of Computer Science',
    ],
  },
  {
    school: 'Kasturba Medical College',
    branches: [
      'Anatomy',
      'Anesthesiology',
      'Biochemistry',
      'Dermatology',
      'Emergency Medicine',
      'Forensic Medicine',
      'Gastroenterology and Hepatology',
      'General Medicine',
      'Hospital Administration',
      'Immunohematology',
      'Microbiology',
      'Orthopaedics',
      'Palliative Care',
      'Pediatrics',
      'Pharmacology',
      'Physiology',
    ],
  },
  {
    school: 'T. A. Pai Management Institute',
    branches: [
      'MBA - Core',
      'MBA - BKFS',
      'MBA - HRM',
      'MBA - Marketing',
      'MBA - IB',
      'MBA - AI & DS',
      'MBA - Technology Management',
    ],
  },
  {
    school: 'Department of Commerce',
    branches: [
      'B.Com (Honors)',
      'B.Com (Professional)',
      'BBA',
      'M.Com (Finance & Accounting)',
      'M.Com (Professional)',
      'M.Sc (Business Analytics)',
    ],
  },
  {
    school: 'Manipal School of Architecture and Planning',
    branches: [
      'Faculty of Architecture',
      'Department of Design',
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
