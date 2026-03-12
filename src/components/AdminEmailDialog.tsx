import { useState, useEffect } from "react";
import { parsePhoneNumber } from 'libphonenumber-js';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"; // Assuming we might want textareas for longer content, though not strictly required by current templates
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AdminEmailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    profile: {
        id: string;
        first_name: string;
        email: string;
    } | null;
    dates: any[];
    allProfiles: any[];
    targetDate: any | null; // Date object for dual-recipient emails
}

interface TemplateField {
    key: string;
    label: string;
    placeholder?: string;
    defaultValue?: string;
}

interface EmailTemplateConfig {
    type: string;
    label: string;
    fields: TemplateField[];
}

const EMAIL_TEMPLATES: EmailTemplateConfig[] = [
    {
        type: "new_match",
        label: "New Match",
        fields: []
    },
    {
        type: "new_date",
        label: "New Date",
        fields: [
            { key: "partnerName", label: "Partner Name", defaultValue: "<Partner Name>" },
            { key: "firstDay", label: "First Possible Day (e.g., 'Monday')" }
        ]
    },
    {
        type: "match_cancelled",
        label: "Match Cancelled",
        fields: []
    },
    {
        type: "date_cancelled",
        label: "Date Cancelled",
        fields: [
            { key: "partnerName", label: "Partner Name", defaultValue: "<Partner Name>" },
            { key: "cancellationReason", label: "Cancellation Reason", placeholder: "Optional" }
        ]
    },
    {
        type: "no_overlap",
        label: "No Availability Overlap",
        fields: [
            { key: "partnerName", label: "Partner Name", defaultValue: "<Partner Name>" }
        ]
    },
    {
        type: "first_confirm",
        label: "First Confirm",
        fields: [
            { key: "partnerName", label: "Partner Name", defaultValue: "<Partner Name>" }
        ]
    },
    {
        type: "date_rescheduled",
        label: "Date Rescheduled",
        fields: [
            { key: "partnerName", label: "Partner Name", defaultValue: "<Partner Name>" },
            { key: "rescheduleReason", label: "Reason", placeholder: "Optional" }
        ]
    },
    {
        type: "date_confirmed_details",
        label: "Date Confirmed Details",
        fields: [
            { key: "partnerName", label: "Partner Name", defaultValue: "<Partner Name>" },
            { key: "dateDetails.date", label: "Date (e.g. Oct 24)" },
            { key: "dateDetails.weekday", label: "Weekday (e.g. Saturday)" },
            { key: "dateDetails.time", label: "Time (e.g. 7:00 PM)" },
            { key: "dateDetails.locationName", label: "Location Name" },
            { key: "dateDetails.locationAddress", label: "Location Address" },
        ]
    },
    {
        type: "date_update_reset",
        label: "Date Update Reset",
        fields: [
            { key: "partnerName", label: "Partner Name", defaultValue: "<Partner Name>" }
        ]
    },
    {
        type: "new_dates_launch",
        label: "New Dates Feature Launch",
        fields: []
    },
    {
        type: "date_reminder_1d",
        label: "Date Reminder (Day Before)",
        fields: [
            { key: "partnerName", label: "Partner Name", defaultValue: "<Partner Name>" },
            { key: "dateDetails.date", label: "Date (e.g. Oct 24)" },
            { key: "dateDetails.weekday", label: "Weekday (e.g. Saturday)" },
            { key: "dateDetails.time", label: "Time (e.g. 7:00 PM)" },
            { key: "dateDetails.locationName", label: "Location Name" },
            { key: "dateDetails.locationAddress", label: "Location Address" },
        ]
    },
    {
        type: "date_reminder_1h",
        label: "Date Reminder (1 Hour Before)",
        fields: [
            { key: "partnerName", label: "Partner Name", defaultValue: "<Partner Name>" },
            { key: "partnerPhone", label: "Partner Phone", defaultValue: "<Partner Phone>" },
            { key: "dateDetails.date", label: "Date (e.g. Oct 24)" },
            { key: "dateDetails.weekday", label: "Weekday (e.g. Saturday)" },
            { key: "dateDetails.time", label: "Time (e.g. 7:00 PM)" },
            { key: "dateDetails.locationName", label: "Location Name" },
            { key: "dateDetails.locationAddress", label: "Location Address" },
        ]
    },
    {
        type: "date_reminder_soon",
        label: "Date Reminder (Soon)",
        fields: [
            { key: "partnerName", label: "Partner Name", defaultValue: "<Partner Name>" },
            { key: "partnerPhone", label: "Partner Phone", defaultValue: "<Partner Phone>" },
            { key: "dateDetails.date", label: "Date (e.g. Oct 24)" },
            { key: "dateDetails.weekday", label: "Weekday (e.g. Saturday)" },
            { key: "dateDetails.time", label: "Time (e.g. 7:00 PM)" },
            { key: "dateDetails.locationName", label: "Location Name" },
            { key: "dateDetails.locationAddress", label: "Location Address" },
        ]
    },
    {
        type: "event_announcement",
        label: "Event Announcement (Plaza)",
        fields: []
    }
];

export default function AdminEmailDialog({ open, onOpenChange, profile, targetDate, dates, allProfiles }: AdminEmailDialogProps) {
    const { toast } = useToast();
    const [selectedType, setSelectedType] = useState<string>("");
    const [selectedDateId, setSelectedDateId] = useState<string>("none");
    const [formData, setFormData] = useState<Record<string, string>>({}); // User 1 (or single profile)
    const [formData2, setFormData2] = useState<Record<string, string>>({}); // User 2 (only for dual mode)
    const [isSending, setIsSending] = useState(false);

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (open) {
            setSelectedType("");
            setSelectedDateId("none");
            setFormData({});
            setFormData2({});

            // If targetDate is provided, auto-select it and prepopulate
            if (targetDate) {
                // Determine a safe default type? Maybe "date_confirmed_details" or let user pick.
                // Let's just select the date logic.
                handleDateSelect(targetDate.id, targetDate);
            }
        }
    }, [open, targetDate]);

    // Handle Date Selection and Autofill
    const handleDateSelect = (dateId: string, directDateObj?: any) => {
        setSelectedDateId(dateId);

        let date = directDateObj;
        if (!date && dateId !== "none") {
            date = dates.find(d => d.id === dateId);
        }

        if (!date) return;

        // Helper to format phone numbers
        const formatPhoneNumber = (phone: string): string => {
            if (!phone) return phone;
            try {
                const phoneNumber = parsePhoneNumber(phone);
                if (phoneNumber) {
                    return phoneNumber.format('INTERNATIONAL');
                }
                return phone;
            } catch (error) {
                // If parsing fails (e.g. invalid number), return original
                return phone;
            }
        };

        // Auto-fill logic
        const populateForm = (userProfile: any, otherProfile: any, isPhoneShared: boolean) => {
            const partnerName = otherProfile ? otherProfile.first_name : "Unknown Partner";
            const partnerPhone = otherProfile?.phone_number
                ? (isPhoneShared ? formatPhoneNumber(otherProfile.phone_number) : "Not Shared")
                : "Not Available";

            const newFormData: Record<string, string> = {
                partnerName,
                partnerPhone
            };

            if (date.first_possible_day) {
                newFormData.firstDay = date.first_possible_day;
            }

            if (date.cancellation_reason) {
                newFormData.cancellationReason = date.cancellation_reason;
            }

            // Date Details
            if (date.date_time) {
                const d = new Date(date.date_time);
                const timeZone = date.timezone;

                const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
                const weekdayOptions: Intl.DateTimeFormatOptions = { weekday: 'long' };
                const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

                if (timeZone) {
                    dateOptions.timeZone = timeZone;
                    weekdayOptions.timeZone = timeZone;
                    timeOptions.timeZone = timeZone;
                }

                newFormData["dateDetails.date"] = d.toLocaleDateString('en-US', dateOptions); // Oct 24
                newFormData["dateDetails.weekday"] = d.toLocaleDateString('en-US', weekdayOptions); // Saturday
                // Explicitly use formatting that matches the admin cards for time
                newFormData["dateDetails.time"] = d.toLocaleTimeString('en-US', timeOptions); // 7:00 PM
            }

            if (date.location) {
                newFormData["dateDetails.locationName"] = date.location;
                if (date.address) {
                    newFormData["dateDetails.locationAddress"] = date.address;
                }
            }
            return newFormData;
        };

        if (targetDate) {
            // Dual Mode: Populate both forms
            const user1 = allProfiles.find(p => p.id === targetDate.user1_id);
            const user2 = allProfiles.find(p => p.id === targetDate.user2_id);

            // Check share flags
            // For User 1 form, we need Partner's (User 2's) phone. So check user2_share_phone.
            // For User 2 form, we need User 1's phone. So check user1_share_phone.
            const u1PhoneShared = targetDate.user1_share_phone ?? true; // Default to true if undefined to be safe, or false? Let's assume true for backward compat? Or false. The user request implies it's a field.
            const u2PhoneShared = targetDate.user2_share_phone ?? true;

            if (user1 && user2) {
                setFormData(populateForm(user1, user2, u2PhoneShared));
                setFormData2(populateForm(user2, user1, u1PhoneShared));
            }
        } else if (profile) {
            // Single Mode
            const partnerId = date.user1_id === profile.id ? date.user2_id : date.user1_id;
            const partnerProfile = allProfiles.find(p => p.id === partnerId);

            // If I am user1, I need user2's phone (check user2_share_phone)
            // If I am user2, I need user1's phone (check user1_share_phone)
            const isUser1 = profile.id === date.user1_id;
            const isPartnerPhoneShared = isUser1 ? date.user2_share_phone : date.user1_share_phone;

            setFormData(populateForm(profile, partnerProfile, isPartnerPhoneShared ?? true));
        }
    };

    const handleFieldChange = (key: string, value: string, formNumber: 1 | 2 = 1) => {
        const updater = formNumber === 1 ? setFormData : setFormData2;
        updater(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const getSelectedTemplate = () => EMAIL_TEMPLATES.find(t => t.type === selectedType);

    const constructCustomData = (sourceFormData: Record<string, string>) => {
        const template = getSelectedTemplate();
        if (!template) return {};

        const customData: any = {};

        template.fields.forEach(field => {
            const value = sourceFormData[field.key] || field.defaultValue || "";

            if (!value && !field.placeholder?.includes("Optional")) {
                // Simple client-side validation
            }

            // Handle nested keys like "dateDetails.locationName"
            if (field.key.includes('.')) {
                const parts = field.key.split('.');
                let current = customData;
                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i];
                    if (!current[part]) current[part] = {};
                    current = current[part];
                }
                current[parts[parts.length - 1]] = value;
            } else {
                customData[field.key] = value;
            }
        });

        return customData;
    };

    const handleSend = async (target: 'user1' | 'user2' | 'both') => {
        if (!selectedType) return;
        if (!profile && !targetDate) return;

        setIsSending(true);
        try {
            const recipients = [];

            if (targetDate) {
                // Dual Send Mode
                const user1 = allProfiles.find(p => p.id === targetDate.user1_id);
                const user2 = allProfiles.find(p => p.id === targetDate.user2_id);

                if (user1 && (target === 'user1' || target === 'both')) {
                    recipients.push({
                        userId: user1.id,
                        customData: constructCustomData(formData)
                    });
                }

                if (user2 && (target === 'user2' || target === 'both')) {
                    recipients.push({
                        userId: user2.id,
                        customData: constructCustomData(formData2)
                    });
                }
            } else if (profile) {
                // Single Send Mode (Always User 1 form)
                recipients.push({
                    userId: profile.id,
                    customData: constructCustomData(formData)
                });
            }

            if (recipients.length === 0) return;

            const { data, error } = await supabase.functions.invoke('send-user-emails', {
                body: {
                    emailType: selectedType,
                    recipients
                }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            toast({
                title: "Email Sent",
                description: `Successfully sent ${getSelectedTemplate()?.label} email to ${recipients.length} recipient(s).`,
            });

            // Only close if sending to both or single mode. If sending individual, maybe keep open? 
            // User requested "three total buttons", implying they might want to send one then the other?
            // "There should be three total buttons, two for sending seperately, and one to send both"
            // Usually if I send one, I probably want to see success and maybe send the other.
            // Let's NOT close if sending separately.
            if (target === 'both' || profile) {
                onOpenChange(false);
            }
        } catch (error: any) {
            console.error("Failed to send email:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to send email",
                variant: "destructive"
            });
        } finally {
            setIsSending(false);
        }
    };

    const selectedTemplate = getSelectedTemplate();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader>
                    <DialogTitle>
                        {targetDate
                            ? `Send Email for Date ${targetDate.id.slice(0, 8)}...`
                            : `Send Email to ${profile?.first_name}`}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Email Type</Label>
                        <Select value={selectedType} onValueChange={setSelectedType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select email template..." />
                            </SelectTrigger>
                            <SelectContent>
                                {EMAIL_TEMPLATES.map((t) => (
                                    <SelectItem key={t.type} value={t.type}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date Selector for Autofill */}
                    {selectedType && dates && dates.length > 0 && !targetDate && (
                        <div className="space-y-2">
                            <Label>Autofill from Date (Optional)</Label>
                            <Select value={selectedDateId} onValueChange={handleDateSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a date to autofill..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {dates.map((d) => {
                                        const partnerId = d.user1_id === profile?.id ? d.user2_id : d.user1_id;
                                        const partner = allProfiles.find(p => p.id === partnerId);
                                        const partnerName = partner ? partner.first_name : "Unknown";
                                        return (
                                            <SelectItem key={d.id} value={d.id}>
                                                {d.status} w/ {partnerName} ({d.created_at ? new Date(d.created_at).toLocaleDateString() : 'N/A'})
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {selectedTemplate && selectedTemplate.fields.length > 0 && (
                        <div className="border-t pt-4">
                            <h4 className="text-sm font-medium text-muted-foreground mb-3">Template Fields</h4>

                            {targetDate ? (
                                <div className="grid grid-cols-2 gap-6">
                                    {/* User 1 Column */}
                                    <div className="space-y-3 p-3 border rounded-md bg-slate-50 relative">
                                        <div className="flex justify-between items-center mb-2">
                                            <h5 className="font-semibold text-sm">
                                                {allProfiles.find(p => p.id === targetDate.user1_id)?.first_name || "User 1"}
                                            </h5>
                                            {/* Badge for User 1's Phone Share Status */}
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${targetDate.user1_share_phone ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                Phone Shared: {targetDate.user1_share_phone ? 'Yes' : 'No'}
                                            </span>
                                        </div>
                                        {selectedTemplate.fields.map((field) => (
                                            <div key={`u1-${field.key}`} className="space-y-1">
                                                <Label htmlFor={`u1-${field.key}`} className="text-xs">{field.label}</Label>
                                                <Input
                                                    id={`u1-${field.key}`}
                                                    placeholder={field.placeholder}
                                                    value={formData[field.key] || ""}
                                                    onChange={(e) => handleFieldChange(field.key, e.target.value, 1)}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* User 2 Column */}
                                    <div className="space-y-3 p-3 border rounded-md bg-slate-50 relative">
                                        <div className="flex justify-between items-center mb-2">
                                            <h5 className="font-semibold text-sm">
                                                {allProfiles.find(p => p.id === targetDate.user2_id)?.first_name || "User 2"}
                                            </h5>
                                            {/* Badge for User 2's Phone Share Status */}
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${targetDate.user2_share_phone ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                Phone Shared: {targetDate.user2_share_phone ? 'Yes' : 'No'}
                                            </span>
                                        </div>
                                        {selectedTemplate.fields.map((field) => (
                                            <div key={`u2-${field.key}`} className="space-y-1">
                                                <Label htmlFor={`u2-${field.key}`} className="text-xs">{field.label}</Label>
                                                <Input
                                                    id={`u2-${field.key}`}
                                                    placeholder={field.placeholder}
                                                    value={formData2[field.key] || ""}
                                                    onChange={(e) => handleFieldChange(field.key, e.target.value, 2)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                /* Single Profile Mode */
                                <div className="space-y-3">
                                    {selectedTemplate.fields.map((field) => (
                                        <div key={field.key} className="space-y-1">
                                            <Label htmlFor={field.key} className="text-xs">{field.label}</Label>
                                            <Input
                                                id={field.key}
                                                placeholder={field.placeholder}
                                                value={formData[field.key] || ""}
                                                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {selectedTemplate && selectedTemplate.fields.length === 0 && (
                        <p className="text-sm text-muted-foreground italic text-center py-2">
                            No additional fields required for this template.
                        </p>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
                        Cancel
                    </Button>

                    {targetDate ? (
                        <>
                            {/* User 1 Button */}
                            <Button variant="secondary" onClick={() => handleSend('user1')} disabled={!selectedType || isSending}>
                                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                    `Send to ${allProfiles.find(p => p.id === targetDate.user1_id)?.first_name || "User 1"}`}
                            </Button>

                            {/* User 2 Button */}
                            <Button variant="secondary" onClick={() => handleSend('user2')} disabled={!selectedType || isSending}>
                                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                    `Send to ${allProfiles.find(p => p.id === targetDate.user2_id)?.first_name || "User 2"}`}
                            </Button>

                            {/* Both Button */}
                            <Button onClick={() => handleSend('both')} disabled={!selectedType || isSending}>
                                {isSending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending Both...
                                    </>
                                ) : (
                                    "Send to Both"
                                )}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => handleSend('user1')} disabled={!selectedType || isSending}>
                            {isSending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                "Send Email"
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
