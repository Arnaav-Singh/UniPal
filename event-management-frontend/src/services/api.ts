// Typed API client consolidating REST calls to the backend service.
import {
	User,
	Event,
	Attendance,
	AttendanceRecord,
	Feedback,
	AuthUser,
	BackendUser,
	BackendEvent,
	BackendFeedback,
	BackendAuthResponse,
	BackendStatsResponse,
	EventReport,
	BackendEventReport,
	EventInvitation,
	BackendInvitation,
	EventAgendaItem,
	EventContact,
	BackendAgendaItem,
	BackendContact,
	DeanOverviewMetrics,
	DirectoryResponse,
	EventOverview,
} from '@/types';

const API_BASE_URL =
	(import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL?.replace(/\/+$/, '') ||
	'http://localhost:5050';

// Pull the persisted JWT used for authenticated requests.
function getAuthToken(): string | null {
	return localStorage.getItem('auth_token');
}

// Include the bearer token when available.
function authHeaders(): Record<string, string> {
	const token = getAuthToken();
	return token ? { Authorization: `Bearer ${token}` } : {};
}

// Wrapper around fetch that centralises error handling and JSON parsing.
async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
	const headers: Record<string, string> = {
		...(options.headers as Record<string, string>),
	};
	const hasBody = options.body !== undefined && options.body !== null;
	if (hasBody && !(options.body instanceof FormData)) {
		headers['Content-Type'] = headers['Content-Type'] || 'application/json';
	}

	let res: Response;
	try {
		res = await fetch(`${API_BASE_URL}${path}`, {
			...options,
			headers,
			credentials: 'include',
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Network request failed';
		throw new Error(message);
	}
	if (!res.ok) {
		let message = 'Request failed';
		try {
			const data = await res.json();
			message = data?.message || message;
		} catch (_) {
			// ignore JSON parsing issues
		}
		throw new Error(message);
	}
	try {
		return (await res.json()) as T;
	} catch (_) {
		return undefined as unknown as T;
	}
}

// Convert backend role strings into the UI friendly subset.
function mapRoleFromBackend(role: string): User['role'] {
	switch (role) {
		case 'dean':
			return 'dean';
		case 'superadmin':
			return 'superadmin';
		case 'admin':
			return 'dean';
		case 'coordinator':
			return 'coordinator';
		case 'attender':
		case 'student':
			return 'student';
		default:
			return 'student';
	}
}

// Translate UI role choices back to backend constants.
function mapRoleToBackend(role: User['role']): string {
	switch (role) {
		case 'student':
			return 'student';
		case 'dean':
			return 'dean';
		case 'superadmin':
			return 'superadmin';
		default:
			return role;
	}
}

// Normalise backend user payloads into the shape consumed by the UI.
function mapUser(bu: BackendUser): User {
	return {
		id: bu._id || bu.id || bu.userID,
		name: bu.name,
		email: bu.email,
		role: mapRoleFromBackend(bu.role),
		created_at: bu.createdAt || new Date().toISOString(),
		registration_id: bu.registrationId || bu.userID,
		phone: bu.phone,
		school: bu.school,
		department: bu.department,
		designation: bu.designation,
	};
}

// Safely adapt optional event report summaries.
function normaliseEventReport(report?: BackendEventReport | null): EventReport | undefined {
	if (!report) return undefined;
	return {
		generated_at: report.generatedAt,
		attendee_count: report.attendeeCount ?? 0,
		feedback_count: report.feedbackCount ?? 0,
		average_rating: report.averageRating ?? 0,
		notes: report.notes,
		recipients: report.recipients?.map((rec) =>
			typeof rec === 'string' ? rec : (rec._id || rec.id || rec.userID)
		),
	};
}

// Prepare agenda entries before sending them to the backend.
function mapAgendaToBackend(items?: EventAgendaItem[]): BackendAgendaItem[] {
	if (!Array.isArray(items)) return [];
	return items.map((item) => ({
		title: item.title,
		startTime: item.start_time,
		endTime: item.end_time,
		speaker: item.speaker,
		location: item.location,
	}));
}

// Prepare contact records for backend consumption.
function mapContactsToBackend(items?: EventContact[]): BackendContact[] {
	if (!Array.isArray(items)) return [];
	return items.map((contact) => ({
		name: contact.name,
		role: contact.role,
		email: contact.email,
		phone: contact.phone,
	}));
}

// Convert backend event documents into the richer frontend representation.
function mapEvent(be: BackendEvent): Event {
	const rawCoordinators = Array.isArray(be.coordinators) ? be.coordinators : [];
	const coordinatorIds = rawCoordinators
		.map((coord) => (typeof coord === 'string' ? coord : coord?._id || coord?.id || coord?.userID))
		.filter((id): id is string => Boolean(id));
	const coordinatorNames = rawCoordinators
		.map((coord) => (typeof coord === 'string' ? '' : coord?.name))
		.filter((name): name is string => Boolean(name));
	const approvedById = typeof be.approvedBy === 'string'
		? be.approvedBy
		: be.approvedBy?._id || be.approvedBy?.id || undefined;
	const approvedByName = typeof be.approvedBy === 'string'
		? undefined
		: be.approvedBy?.name;

	return {
		id: be._id || be.id || be.eventID,
		title: be.title || be.name || 'Untitled Event',
		description: be.description || '',
		date: be.date,
		time: be.time,
		location: be.location,
		school: be.school,
		department: be.department,
		status: be.status || 'scheduled',
		invitation_mode: be.invitationMode || 'invite-only',
		allow_self_check_in: be.allowSelfCheckIn ?? true,
		category: be.category || 'other',
		event_format: be.eventFormat || 'other',
		delivery_mode: be.deliveryMode || 'in-person',
		tags: Array.isArray(be.tags) ? be.tags : [],
		sponsors: Array.isArray(be.sponsors) ? be.sponsors : [],
		budget: {
			currency: be.budget?.currency || 'INR',
			amount: Number(be.budget?.amount ?? 0) || 0,
		},
		requires_approval: be.requiresApproval ?? true,
		approval_status: be.approvalStatus || 'pending',
		approval_notes: be.approvalNotes || undefined,
		approved_at: be.approvedAt,
		approved_by: approvedById,
		approved_by_name: approvedByName,
		feedback_open: be.feedbackOpen ?? false,
		coordinators: coordinatorIds,
		coordinator_names: coordinatorNames,
		assigned_coordinator: coordinatorIds[0] || '',
		qr_code: be.qr_code,
		google_form_url: be.google_form_url,
		created_at: be.createdAt || new Date().toISOString(),
		agenda: Array.isArray(be.agenda)
			? be.agenda.map((item) => ({
				title: item?.title,
				start_time: item?.startTime,
				end_time: item?.endTime,
				speaker: item?.speaker,
				location: item?.location,
			}))
			: [],
		important_contacts: Array.isArray(be.importantContacts)
			? be.importantContacts.map((contact) => ({
				name: contact?.name || '',
				role: contact?.role,
				email: contact?.email,
				phone: contact?.phone,
			}))
			: [],
		report: normaliseEventReport(be.report) ?? null,
		feedback_submitted: Boolean(
			(be as { feedbackSubmitted?: boolean }).feedbackSubmitted ??
			(be as { feedback_submitted?: boolean }).feedback_submitted ??
			false
		),
		sdg: Array.isArray(be.sdg) ? be.sdg : [], // Map sdg
	};
}

// Adapt backend feedback entries into the frontend shape.
function mapFeedback(fb: BackendFeedback): Feedback {
	const mappedUser = fb.user && typeof fb.user === 'object' && 'email' in fb.user
		? mapUser(fb.user as BackendUser)
		: undefined;
	return {
		id: fb._id || fb.id || crypto.randomUUID(),
		event_id: fb.event?._id || fb.event_id || '',
		student_id: fb.user?._id || fb.student_id || '',
		rating: fb.rating,
		comments: fb.comments || '',
		created_at: fb.createdAt || new Date().toISOString(),
		user: mappedUser,
	};
}

// Translate invitation payloads and hydrate invitee/inviter metadata.
function mapInvitation(invitation: BackendInvitation): EventInvitation {
	const invitee = invitation.invitee ? mapUser(invitation.invitee) : {
		id: '',
		name: 'Unknown',
		email: '',
		role: 'student',
		created_at: new Date().toISOString(),
	} as User;

	const invitedBy = invitation.invitedBy ? mapUser(invitation.invitedBy) : undefined;

	return {
		id: invitation._id || invitation.id || crypto.randomUUID(),
		event_id: typeof invitation.event === 'string'
			? invitation.event
			: invitation.event?._id || invitation.event?.id || '',
		role_at_event: invitation.roleAtEvent,
		status: invitation.status,
		message: invitation.message,
		invited_at: invitation.createdAt || new Date().toISOString(),
		responded_at: invitation.respondedAt || invitation.updatedAt,
		invitee,
		invited_by: invitedBy,
	};
}

function mapAttendanceRecord(raw: { userId: string; registrationId?: string; name: string; email: string; signature?: string | null; timestamp?: string | null; school?: string; department?: string; }): AttendanceRecord {
	return {
		user_id: raw.userId,
		registration_id: raw.registrationId,
		name: raw.name,
		email: raw.email,
		signature: raw.signature ?? null,
		timestamp: raw.timestamp ?? null,
		school: raw.school,
		department: raw.department,
	};
}

// Defensive parsing for the hierarchical directory response.
function normaliseDirectoryResponse(payload: DirectoryResponse): DirectoryResponse {
	const safeRole: DirectoryResponse['role'] =
		payload?.role === 'coordinator' ? 'coordinator' : 'student';
	const schools = Array.isArray(payload?.schools) ? payload.schools : [];

	return {
		role: safeRole,
		schools: schools.map((school) => {
			const schoolName = school?.school || 'Unassigned';
			const departments = Array.isArray(school?.departments) ? school.departments : [];
			const normalisedDepartments = departments.map((dept) => {
				const deptName = dept?.department || 'General';
				const members = Array.isArray(dept?.members) ? dept.members : [];
				const normalisedMembers = members.map((member) => ({
					id: member?.id ? String(member.id) : crypto.randomUUID(),
					name: member?.name || 'Unknown',
					email: member?.email || '',
					role: (member?.role === 'coordinator' ? 'coordinator' : 'student') as 'coordinator' | 'student',
					school: member?.school || schoolName,
					department: member?.department || deptName,
				}));
				const count = typeof dept?.count === 'number' ? dept.count : normalisedMembers.length;
				return {
					department: deptName,
					count,
					members: normalisedMembers,
				};
			});
			const totalMembers = typeof school?.totalMembers === 'number'
				? school.totalMembers
				: normalisedDepartments.reduce((sum, dept) => sum + dept.count, 0);
			return {
				school: schoolName,
				totalMembers,
				departments: normalisedDepartments,
			};
		}),
	};
}

// Convenience helper to read the role stored in localStorage.
function currentUserRole(): User['role'] | null {
	if (typeof window === 'undefined') return null;
	try {
		const stored = localStorage.getItem('auth_user');
		if (!stored) return null;
		const parsed = JSON.parse(stored);
		return parsed?.role ?? null;
	} catch (_) {
		return null;
	}
}

type GetUsersOptions = {
	roles?: User['role'][];
	school?: string;
	search?: string;
	scope?: 'all' | 'others';
};

// Encapsulates REST calls with strongly typed helpers.
class APIService {
	// Authentication
	async login(email: string, password: string): Promise<AuthUser> {
		const data = await http<BackendAuthResponse>('/api/auth/login', {
			method: 'POST',
			body: JSON.stringify({ email, password }),
		});
		const user = mapUser(data);
		const token: string = data.token;
		return { user, token };
	}

	async register(userData: { name: string; email: string; password: string; role: 'dean' | 'admin' | 'coordinator' | 'student' | 'superadmin'; school?: string; department?: string; designation?: string; }): Promise<AuthUser> {
		const payload = {
			name: userData.name,
			email: userData.email,
			password: userData.password,
			role: mapRoleToBackend(userData.role),
			school: userData.school,
			department: userData.department,
			designation: userData.designation,
		};
		const data = await http<BackendAuthResponse>('/api/auth/register', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
		const user = mapUser(data);
		const token: string = data.token;
		return { user, token };
	}

	async provisionUser(userData: { name: string; email: string; password: string; role: 'dean' | 'admin' | 'coordinator' | 'student' | 'superadmin'; school?: string; department?: string; designation?: string; }): Promise<User> {
		const payload = {
			name: userData.name,
			email: userData.email,
			password: userData.password,
			role: mapRoleToBackend(userData.role),
			school: userData.school,
			department: userData.department,
			designation: userData.designation,
		};
		const data = await http<BackendAuthResponse>('/api/auth/register', {
			method: 'POST',
			headers: { ...authHeaders() },
			body: JSON.stringify(payload),
		});
		return mapUser(data);
	}

	// Users
	async getUsers(options: GetUsersOptions = {}): Promise<User[]> {
		const role = currentUserRole();
		const endpoint = role === 'dean' ? '/api/superadmin/users' : '/api/admin/users';
		const params = new URLSearchParams();
		const roles = options.roles?.length ? options.roles : undefined;

		if (roles) {
			const backendRoles = roles.map(mapRoleToBackend);
			params.set('roles', backendRoles.join(','));
		}
		if (options.scope) {
			params.set('scope', options.scope);
		}
		if (options.school) {
			params.set('school', options.school);
		}
		if (options.search && options.search.trim().length > 0) {
			params.set('search', options.search.trim());
		}

		const query = params.toString();
		const url = query ? `${endpoint}?${query}` : endpoint;
		const data = await http<BackendUser[]>(url, { headers: { ...authHeaders() } });
		return data.map(mapUser);
	}

	async getUserById(id: string): Promise<User | null> {
		const users = await this.getUsers({ scope: 'all' });
		return users.find((u) => u.id === id) || null;
	}

	async getCoordinators(): Promise<User[]> {
		const role = currentUserRole();
		const endpoint =
			role === 'dean'
				? '/api/superadmin/users?role=coordinator'
				: '/api/admin/users?role=coordinator';
		const data = await http<BackendUser[]>(endpoint, { headers: { ...authHeaders() } });
		return data.map(mapUser);
	}

	async getDirectory(role: 'student' | 'coordinator' = 'student'): Promise<DirectoryResponse> {
		const params = new URLSearchParams({ role });
		const response = await http<DirectoryResponse>(`/api/coordinators/directory?${params.toString()}`, {
			headers: { ...authHeaders() },
		});
		return normaliseDirectoryResponse(response);
	}

	async createParticipantAccount(eventId: string, payload: { name: string; email: string; password: string; role?: string; school?: string; department?: string; registrationId?: string; phone?: string; }): Promise<User> {
		const data = await http<{ user: BackendUser }>(`/api/coordinators/events/${eventId}/participants`, {
			method: 'POST',
			headers: { ...authHeaders() },
			body: JSON.stringify(payload),
		});
		return mapUser(data.user);
	}

	// Events
	async getEvents(): Promise<Event[]> {
		const data = await http<BackendEvent[]>('/api/events');
		const list = Array.isArray(data) ? data : [];
		return list.map(mapEvent);
	}

	async getEventById(id: string): Promise<Event | null> {
		const data = await http<BackendEvent>(`/api/events/${id}`);
		return mapEvent(data);
	}

	async getEventOverview(eventId: string): Promise<EventOverview> {
		const data = await http<{
			event: BackendEvent;
			attendance?: Array<{ userId: string; registrationId?: string; name: string; email: string; signature?: string | null; timestamp?: string | null; school?: string; department?: string; }>;
			feedback?: { averageRating?: number; total?: number; entries?: BackendFeedback[] };
		}>(`/api/events/${eventId}/overview`, { headers: { ...authHeaders() } });

		const attendance = (data.attendance || []).map(mapAttendanceRecord);
		const feedbackEntries = (data.feedback?.entries || []).map(mapFeedback);
		return {
			event: mapEvent(data.event),
			attendance,
			feedback: {
				averageRating: data.feedback?.averageRating ?? 0,
				total: data.feedback?.total ?? feedbackEntries.length,
				entries: feedbackEntries,
			},
		};
	}

	async getEventsByCoordinator(coordinatorId: string): Promise<Event[]> {
		const all = await this.getEvents();
		return all.filter((event) => event.coordinators.includes(coordinatorId));
	}

	async deleteUser(userId: string, password: string): Promise<void> {
		await http(`/api/superadmin/users/${userId}`, {
			method: 'DELETE',
			headers: { ...authHeaders() },
			body: JSON.stringify({ password }),
		});
	}

	async createEvent(eventData: {
		title: string;
		description: string;
		date: string;
		startDate?: string;
		endDate?: string;
		location: string;
		school?: string;
		department?: string;
		invitation_mode?: 'open' | 'invite-only';
		allow_self_check_in?: boolean;
		coordinator_ids?: string[];
		google_form_url?: string;
		category?: string;
		event_format?: string;
		delivery_mode?: 'in-person' | 'online' | 'hybrid';
		tags?: string[];
		sponsors?: string[];
		budget?: { currency?: string; amount?: number };
		agenda?: EventAgendaItem[];
		important_contacts?: EventContact[];
		requires_approval?: boolean;
		approval_notes?: string;
		sdg?: string[];
		guest_speakers?: string[];
	}): Promise<Event> {
		const payload = {
			name: eventData.title,
			description: eventData.description,
			date: eventData.date,
			startDate: eventData.startDate,
			endDate: eventData.endDate,
			location: eventData.location,
			school: eventData.school,
			department: eventData.department,
			invitationMode: eventData.invitation_mode,
			allowSelfCheckIn: eventData.allow_self_check_in,
			coordinatorIds: eventData.coordinator_ids,
			google_form_url: eventData.google_form_url,
			category: eventData.category,
			eventFormat: eventData.event_format,
			deliveryMode: eventData.delivery_mode,
			tags: eventData.tags,
			sponsors: eventData.sponsors,
			budget: eventData.budget,
			agenda: mapAgendaToBackend(eventData.agenda),
			importantContacts: mapContactsToBackend(eventData.important_contacts),
			requiresApproval: eventData.requires_approval,
			approvalNotes: eventData.approval_notes,
			sdg: eventData.sdg,
			guestSpeakers: eventData.guest_speakers,
		};
		const created = await http<BackendEvent>('/api/events', {
			method: 'POST',
			headers: { ...authHeaders() },
			body: JSON.stringify(payload),
		});
		return mapEvent(created);
	}

	async createCoordinatorEvent(eventData: {
		title: string;
		description?: string;
		date: string;
		startDate?: string;
		endDate?: string;
		time?: string;
		location: string;
		school?: string;
		department?: string;
		invitation_mode?: 'open' | 'invite-only';
		allow_self_check_in?: boolean;
		category?: string;
		event_format?: string;
		delivery_mode?: 'in-person' | 'online' | 'hybrid';
		tags?: string[];
		sponsors?: string[];
		budget?: { currency?: string; amount?: number };
		agenda?: EventAgendaItem[];
		important_contacts?: EventContact[];
		sdg?: string[];
		guest_speakers?: string[];
	}): Promise<Event> {
		const payload = {
			title: eventData.title,
			name: eventData.title,
			description: eventData.description,
			date: eventData.date,
			startDate: eventData.startDate,
			endDate: eventData.endDate,
			time: eventData.time,
			location: eventData.location,
			school: eventData.school,
			department: eventData.department,
			category: eventData.category,
			eventFormat: eventData.event_format,
			deliveryMode: eventData.delivery_mode,
			invitationMode: eventData.invitation_mode,
			allowSelfCheckIn: eventData.allow_self_check_in,
			tags: eventData.tags,
			sponsors: eventData.sponsors,
			budget: eventData.budget,
			agenda: mapAgendaToBackend(eventData.agenda),
			importantContacts: mapContactsToBackend(eventData.important_contacts),
			sdg: eventData.sdg,
			guestSpeakers: eventData.guest_speakers,
		};
		const created = await http<BackendEvent>('/api/coordinators/events', {
			method: 'POST',
			headers: { ...authHeaders() },
			body: JSON.stringify(payload),
		});
		return mapEvent(created);
	}

	async updateEvent(id: string, updates: Partial<Event>): Promise<Event | null> {
		const payload: Record<string, unknown> = {};
		if (updates.title) payload.name = updates.title;
		if (typeof updates.description === 'string') payload.description = updates.description;
		if (updates.date) payload.date = updates.date;
		if (updates.location) payload.location = updates.location;
		if (updates.school) payload.school = updates.school;
		if (updates.department) payload.department = updates.department;
		if (updates.status) payload.status = updates.status;
		if (updates.invitation_mode) payload.invitationMode = updates.invitation_mode;
		if (typeof updates.allow_self_check_in === 'boolean') payload.allowSelfCheckIn = updates.allow_self_check_in;
		if (Array.isArray(updates.coordinators)) payload.coordinatorIds = updates.coordinators;
		if (updates.category) payload.category = updates.category;
		if (updates.event_format) payload.eventFormat = updates.event_format;
		if (updates.delivery_mode) payload.deliveryMode = updates.delivery_mode;
		if (Array.isArray(updates.tags)) payload.tags = updates.tags;
		if (Array.isArray(updates.sponsors)) payload.sponsors = updates.sponsors;
		if (updates.budget) payload.budget = updates.budget;
		if (Array.isArray(updates.agenda)) payload.agenda = mapAgendaToBackend(updates.agenda);
		if (Array.isArray(updates.important_contacts)) payload.importantContacts = mapContactsToBackend(updates.important_contacts);
		if (typeof updates.requires_approval === 'boolean') payload.requiresApproval = updates.requires_approval;
		if (typeof updates.approval_notes === 'string') payload.approvalNotes = updates.approval_notes;
		if (Array.isArray(updates.sdg)) payload.sdg = updates.sdg; // Send sdg update

		const data = await http<BackendEvent>(`/api/events/${id}`, {
			method: 'PUT',
			headers: { ...authHeaders() },
			body: JSON.stringify(payload),
		});
		return mapEvent(data);
	}

	async deleteEvent(id: string): Promise<boolean> {
		await http<void>(`/api/events/${id}`, {
			method: 'DELETE',
			headers: { ...authHeaders() },
		});
		return true;
	}

	async getEventInvitations(eventId: string): Promise<EventInvitation[]> {
		const data = await http<BackendInvitation[]>(`/api/events/${eventId}/invitations`, {
			headers: { ...authHeaders() },
		});
		return data.map(mapInvitation);
	}

	async inviteParticipants(eventId: string, invitees: { userId?: string; email?: string; roleAtEvent?: 'coordinator' | 'attendee'; message?: string; }[]): Promise<EventInvitation[]> {
		const payload = {
			invitees: invitees.map((invitee) => ({
				userId: invitee.userId,
				email: invitee.email,
				roleAtEvent: invitee.roleAtEvent,
				message: invitee.message,
			})),
		};
		const data = await http<BackendInvitation[]>(`/api/events/${eventId}/invitations`, {
			method: 'POST',
			headers: { ...authHeaders() },
			body: JSON.stringify(payload),
		});
		return data.map(mapInvitation);
	}

	async getMyInvitations(): Promise<EventInvitation[]> {
		const data = await http<BackendInvitation[]>('/api/events/invitations/mine', {
			headers: { ...authHeaders() },
		});
		return data.map(mapInvitation);
	}

	async respondToInvitation(invitationId: string, status: 'accepted' | 'declined'): Promise<EventInvitation> {
		const data = await http<BackendInvitation>(`/api/events/invitations/${invitationId}/respond`, {
			method: 'POST',
			headers: { ...authHeaders() },
			body: JSON.stringify({ status }),
		});
		return mapInvitation(data);
	}

	async finalizeEvent(eventId: string, options: { notes?: string; forceResend?: boolean } = {}): Promise<EventReport> {
		const report = await http<{ report: BackendEventReport | null }>(`/api/events/${eventId}/finalize`, {
			method: 'POST',
			headers: { ...authHeaders() },
			body: JSON.stringify({
				notes: options.notes,
				forceResend: options.forceResend,
			}),
		});
		return normaliseEventReport(report.report) || {
			attendee_count: 0,
			feedback_count: 0,
			average_rating: 0,
		};
	}

	async endEvent(eventId: string): Promise<EventOverview> {
		const data = await http<{
			event: BackendEvent;
			attendance?: Array<{ userId: string; registrationId?: string; name: string; email: string; signature?: string | null; timestamp?: string | null; school?: string; department?: string; }>;
			feedback?: { averageRating?: number; total?: number; entries?: BackendFeedback[] };
		}>(`/api/events/${eventId}/end`, {
			method: 'POST',
			headers: { ...authHeaders() },
		});
		const attendance = (data.attendance || []).map(mapAttendanceRecord);
		const feedbackEntries = (data.feedback?.entries || []).map(mapFeedback);
		return {
			event: mapEvent(data.event),
			attendance,
			feedback: {
				averageRating: data.feedback?.averageRating ?? 0,
				total: data.feedback?.total ?? feedbackEntries.length,
				entries: feedbackEntries,
			},
		};
	}

	async updateEventApproval(eventId: string, decision: 'approved' | 'rejected', notes?: string): Promise<Event> {
		const data = await http<BackendEvent>(`/api/events/${eventId}/approval`, {
			method: 'POST',
			headers: { ...authHeaders() },
			body: JSON.stringify({ decision, notes }),
		});
		return mapEvent(data);
	}

	async getDeanOverview(): Promise<DeanOverviewMetrics> {
		const headers = { ...authHeaders() };
		const endpoints = [
			'/api/superadmin/overview',
			'/api/events/stats/dean/overview',
			'/api/events/stats/superadmin/overview',
		];
		let lastError: unknown = null;
		for (const endpoint of endpoints) {
			try {
				return await http<DeanOverviewMetrics>(endpoint, { headers });
			} catch (error) {
				lastError = error;
			}
		}
		if (lastError instanceof Error) {
			throw lastError;
		}
		throw new Error('Unable to load dean overview');
	}

	// Backwards compatibility alias
	async getSuperadminOverview(): Promise<DeanOverviewMetrics> {
		return this.getDeanOverview();
	}

	// Attendance
	async getEventAttendance(eventId: string): Promise<{ attendees: AttendanceRecord[] }> {
		const data = await http<{ attendees?: Array<{ userId: string; registrationId?: string; name: string; email: string; signature?: string | null; timestamp?: string | null; school?: string; department?: string; }>; }>(
			`/api/students/events/${eventId}/attendance`,
			{ headers: { ...authHeaders() } }
		);
		const attendees = (data?.attendees || []).map(mapAttendanceRecord);
		return { attendees };
	}

	async checkInWithCode(eventId: string, payload: { code: string; registrationId?: string; signature?: string; }): Promise<void> {
		await http<void>(`/api/events/${eventId}/attendance/check-in`, {
			method: 'POST',
			headers: { ...authHeaders() },
			body: JSON.stringify(payload),
		});
	}

	async getStudentAttendance(_studentId: string): Promise<{ attendance: Attendance[]; events: Event[] }> {
		const data = await http<BackendEvent[]>('/api/students/my-events', { headers: { ...authHeaders() } });
		const events = data.map(mapEvent);
		return { attendance: [], events };
	}

	async requestAttendanceCode(eventId: string): Promise<{ code: string; expiresAt: string; }> {
		const data = await http<{ code: string; expiresAt: string; }>(`/api/events/${eventId}/attendance/code`, {
			method: 'POST',
			headers: { ...authHeaders() },
		});
		return data;
	}

	async markAttendance(eventId: string, payload: { code: string; registrationId?: string; signature?: string; }): Promise<Attendance> {
		await this.checkInWithCode(eventId, payload);
		return {
			id: crypto.randomUUID(),
			event_id: eventId,
			student_id: 'me',
			scanned_at: new Date().toISOString(),
		};
	}

	// Feedback
	async getEventFeedback(eventId: string): Promise<Feedback[]> {
		const data = await http<BackendFeedback[]>(`/api/feedback/${eventId}`, { headers: { ...authHeaders() } });
		return (data || []).map(mapFeedback);
	}

	async submitFeedback(feedbackData: { event_id: string; rating: number; comments: string; code?: string; }): Promise<Feedback> {
		const data = await http<BackendFeedback>(`/api/feedback/${feedbackData.event_id}`, {
			method: 'POST',
			headers: { ...authHeaders() },
			body: JSON.stringify({
				rating: feedbackData.rating,
				comments: feedbackData.comments,
				code: feedbackData.code,
			}),
		});
		return mapFeedback(data);
	}

	async requestFeedbackCode(eventId: string): Promise<{ code: string; expiresAt: string; }> {
		const data = await http<{ code: string; expiresAt: string; }>(`/api/events/${eventId}/feedback/code`, {
			method: 'POST',
			headers: { ...authHeaders() },
		});
		return data;
	}

	async generateFeedbackQRCode(eventId: string, code?: string): Promise<string> {
		const qrCodeUrl = `${window.location.origin}/feedback/${eventId}${code ? `?code=${code}` : ''}`;
		return qrCodeUrl;
	}

	async generateEventReport(eventId: string, payload: { summary: string; photos: string[]; }): Promise<Blob> {
		const res = await fetch(`${API_BASE_URL}/api/reports/event/${eventId}/pdf`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...authHeaders(),
			},
			credentials: 'include',
			body: JSON.stringify(payload),
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(text || 'Failed to generate report');
		}
		return await res.blob();
	}

	async exportEvents(): Promise<Blob> {
		const res = await fetch(`${API_BASE_URL}/api/reports/export/excel`, {
			method: 'GET',
			headers: {
				...authHeaders(),
			},
			credentials: 'include',
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(text || 'Failed to export events');
		}
		return await res.blob();
	}

	// QR Code helper (frontend still generates the QR image)
	async generateQRCode(eventId: string, code?: string): Promise<string> {
		const qrCodeUrl = `${window.location.origin}/attendance/${eventId}${code ? `?code=${code}` : ''}`;
		return qrCodeUrl;
	}

	// Stats
	async getAdminStats(): Promise<{ totalEvents: number; totalUsers: number; totalCoordinators: number; thisMonthEvents: number; completedEvents: number; }> {
		const role = currentUserRole();
		const usersEndpoint = role === 'dean' ? '/api/superadmin/users' : '/api/admin/users';
		const headers = { ...authHeaders() };
		const [eventsRaw, usersRaw] = await Promise.all([
			http<BackendEvent[]>('/api/events', { headers }),
			http<BackendUser[]>(usersEndpoint, { headers }),
		]);
		let backendStats: { events?: number; attendance?: number; completedEvents?: number; } = {};
		try {
			backendStats = await http<{ events: number; attendance: number; completedEvents: number; }>('/api/events/stats/dean/summary', { headers });
		} catch (_) {
			try {
				backendStats = await http<{ events: number; attendance: number; completedEvents: number; }>('/api/events/stats/admin/summary', { headers });
			} catch (error) {
				console.warn('Unable to load dean stats, falling back to derived metrics.', error);
			}
		}
		const events = eventsRaw.map(mapEvent);
		const users = usersRaw.map(mapUser);
		const thisMonth = new Date().getMonth();
		const thisMonthEvents = events.filter((e) => new Date(e.date).getMonth() === thisMonth).length;
		const totalCoordinators = users.filter((u) => u.role === 'coordinator').length;
		return {
			totalEvents: backendStats.events ?? events.length,
			totalUsers: users.length,
			totalCoordinators,
			thisMonthEvents,
			completedEvents: backendStats.completedEvents ?? events.filter((e) => e.status === 'completed').length,
		};
	}

	async getCoordinatorStats(_coordinatorId: string): Promise<{ assignedEvents: number; totalAttendees: number; avgFeedbackRating: number; completedEvents: number; }> {
		const data = await http<BackendStatsResponse>('/api/events/stats/coordinator/summary', { headers: { ...authHeaders() } })
			.catch(() => ({} as BackendStatsResponse));
		return {
			assignedEvents: data?.assignedEvents ?? data?.events ?? 0,
			totalAttendees: data?.attendance ?? 0,
			avgFeedbackRating: 0,
			completedEvents: data?.completedEvents ?? 0,
		};
	}

	async getStudentStats(_studentId: string): Promise<{ attendedEvents: number; upcomingEvents: number; feedbackGiven: number; }> {
		const [allEvents, myEvents] = await Promise.all([
			this.getEvents(),
			http<BackendEvent[]>('/api/students/my-events', { headers: { ...authHeaders() } }),
		]);
		const now = new Date();
		const upcomingEvents = allEvents.filter((e) => new Date(e.date) > now).length;
		return {
			attendedEvents: (myEvents || []).length,
			upcomingEvents,
			feedbackGiven: 0,
		};
	}
}

export const apiService = new APIService();
