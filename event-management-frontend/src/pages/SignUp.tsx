// Registration experience with staff-category-based role assignment.
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar, UserPlus, ArrowLeft } from 'lucide-react';
import { DEFAULT_SCHOOL, getAllSchools, getBranchesForSchool } from '@/lib/schools';

type StaffCategory = 'teaching' | 'non-teaching' | 'student';
type SignUpRole = 'coordinator' | 'dean';

interface SignUpFormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  staffCategory: StaffCategory;
  role: SignUpRole;
  school: string;
  department: string;
  registrationId: string;
  section: string;
  semester: string;
}

export default function SignUp() {
  const { user, register } = useAuth();
  const initialSchool = DEFAULT_SCHOOL;
  const initialDepartment = getBranchesForSchool(initialSchool)[0] ?? '';
  const [formData, setFormData] = useState<SignUpFormState>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    staffCategory: 'student',
    role: 'coordinator',
    school: initialSchool,
    department: initialDepartment,
    registrationId: '',
    section: '',
    semester: '',
  });
  const [loading, setLoading] = useState(false);
  const schoolOptions = useMemo(() => getAllSchools(), []);
  const branchOptions = useMemo(() => {
    const branches = getBranchesForSchool(formData.school);
    return branches.length > 0 ? branches : ['General'];
  }, [formData.school]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!branchOptions.includes(formData.department)) {
      setFormData((prev) => ({
        ...prev,
        department: branchOptions[0] ?? '',
      }));
    }
  }, [branchOptions, formData.department]);

  // Derive the actual role that will be submitted based on staff category
  const resolvedRole = useMemo(() => {
    if (formData.staffCategory === 'student') return 'student';
    if (formData.staffCategory === 'non-teaching') return 'coordinator';
    // teaching — use the explicitly selected role
    return formData.role;
  }, [formData.staffCategory, formData.role]);

  // Whether the role selector should be shown
  const showRoleSelector = formData.staffCategory === 'teaching';

  // Perform validation before delegating to AuthContext.register.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    if (!formData.school || !formData.department) {
      toast({
        title: "Institute details required",
        description: "Please select your institute and branch so coordinators can reach you easily.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    // Student-specific validation
    if (formData.staffCategory === 'student') {
      if (!formData.registrationId.trim()) {
        toast({
          title: "Registration Number Required",
          description: "Please enter your registration number to continue.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
    }

    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: resolvedRole as 'student' | 'coordinator' | 'dean',
        school: formData.school,
        department: formData.department,
        staffCategory: formData.staffCategory,
        registrationId: formData.staffCategory === 'student' ? formData.registrationId.trim() : undefined,
        section: formData.staffCategory === 'student' && formData.section.trim() ? formData.section.trim() : undefined,
        semester: formData.staffCategory === 'student' && formData.semester ? Number(formData.semester) : undefined,
      });
      toast({
        title: "Account Created!",
        description: "Your account has been created successfully. You can now sign in."
      });
      navigate('/login', { replace: true });
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: "Failed to create account. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Keep form state in sync and reset dependent selects when needed.
  const handleInputChange = (field: keyof SignUpFormState, value: string) => {
    setFormData((prev) => {
      if (field === 'school') {
        const nextBranches = getBranchesForSchool(value);
        return {
          ...prev,
          school: value,
          department: nextBranches[0] ?? '',
        };
      }
      if (field === 'staffCategory') {
        return { ...prev, staffCategory: value as StaffCategory };
      }
      if (field === 'role') {
        return { ...prev, role: value as SignUpRole };
      }
      return { ...prev, [field]: value };
    });
  };

  // Redirect if already logged in
  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -bottom-40 right-12 h-72 w-72 rounded-full bg-warning/20 blur-[140px]" />
        <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-accent/20 blur-[150px]" />
      </div>

      <div className="relative w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-gradient-primary rounded-[28px] flex items-center justify-center mx-auto mb-5 shadow-glow">
            <Calendar className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            UniPal MIT
          </h1>
          <p className="text-muted-foreground">
            The event companion for MAHE's Manipal Institute of Technology
          </p>
        </div>

        <Card className="hover:-translate-y-1 hover:shadow-glow">
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>
              Sign up to access the event management system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="staffCategory">I am a</Label>
                <Select value={formData.staffCategory} onValueChange={(value: StaffCategory) => handleInputChange('staffCategory', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teaching">Teaching Staff</SelectItem>
                    <SelectItem value="non-teaching">Non-Teaching Staff</SelectItem>
                  </SelectContent>
                </Select>
                {formData.staffCategory === 'non-teaching' && (
                  <p className="text-xs text-muted-foreground">You will be assigned the Coordinator role automatically.</p>
                )}
                {formData.staffCategory === 'student' && (
                  <p className="text-xs text-muted-foreground">You will be assigned the Student role automatically.</p>
                )}
              </div>

              {showRoleSelector && (
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={formData.role} onValueChange={(value: SignUpRole) => handleInputChange('role', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coordinator">Coordinator</SelectItem>
                      <SelectItem value="dean">Dean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="school">Institute</Label>
                <Select value={formData.school} onValueChange={(value) => handleInputChange('school', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select institute" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolOptions.map((school) => (
                      <SelectItem key={school} value={school}>
                        {school}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Branch / Department</Label>
                <Select value={formData.department} onValueChange={(value) => handleInputChange('department', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch or department" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOptions.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.staffCategory === 'student' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="registrationId">Registration Number *</Label>
                    <Input
                      id="registrationId"
                      type="text"
                      value={formData.registrationId}
                      onChange={(e) => handleInputChange('registrationId', e.target.value)}
                      placeholder="e.g. 210905123"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="section">Section</Label>
                      <Input
                        id="section"
                        type="text"
                        value={formData.section}
                        onChange={(e) => handleInputChange('section', e.target.value)}
                        placeholder="e.g. A"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="semester">Semester</Label>
                      <Select value={formData.semester} onValueChange={(value) => handleInputChange('semester', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1,2,3,4,5,6,7,8].map((s) => (
                            <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Create a password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Confirm your password"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full gap-2 shadow-button transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow"
                disabled={loading}
              >
                <UserPlus className="w-4 h-4" />
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="hover:-translate-y-1 hover:shadow-glow">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Already have an account?
              </p>
              <Button asChild variant="outline" className="w-full gap-2 transition-all duration-300 hover:-translate-y-0.5">
                <Link to="/login">
                  <ArrowLeft className="w-4 h-4" />
                  Sign in instead
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
