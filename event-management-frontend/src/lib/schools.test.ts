import { describe, it, expect } from 'vitest';
import { getAllSchools, getBranchesForSchool, SCHOOL_BRANCHES } from './schools';

describe('Schools Logic', () => {
    it('should return all configured institutes', () => {
        const schools = getAllSchools();
        expect(schools).toHaveLength(SCHOOL_BRANCHES.length);
        expect(schools).toContain('Manipal Institute of Technology');
        expect(schools).toContain('Kasturba Medical College');
    });

    it('should return correct departments for MIT', () => {
        const branches = getBranchesForSchool('Manipal Institute of Technology');
        expect(branches).toContain('Aeronautical Engineering');
        expect(branches).toContain('School of Computer Science');
    });

    it('should return correct departments for KMC', () => {
        const branches = getBranchesForSchool('Kasturba Medical College');
        expect(branches).toContain('Anatomy');
        expect(branches).toContain('General Medicine');
    });

    it('should return empty array for invalid institute', () => {
        const branches = getBranchesForSchool('Invalid Institute');
        expect(branches).toEqual([]);
    });
});
