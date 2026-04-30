import { useState, useMemo } from 'react';
import { Edit, Trash2, Calendar, Clock, User, Stethoscope, Phone, FileText, ChevronDown, Filter, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { getRoleImage, getRoleColors } from '@/lib/roleColors';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  type: string;
  status: string;
  notes?: string;
}

interface DetailedAppointmentsTableProps {
  appointments: Appointment[];
  patients: any[];
  profiles: any[];
  onEdit: (appointment: Appointment) => void;
  onDelete: (id: string) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

const statusColors: Record<string, string> = {
  'مجدول': 'bg-gradient-to-r from-orange-400/20 to-orange-600/20 text-orange-700 dark:text-orange-300',
  'مكتمل': 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  'ملغي': 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  'غائب': 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
};

const typeEmojis: Record<string, string> = {
  'فحص': '🩺',
  'استشارة': '💬',
  'متابعة': '📋',
  'عملية': '🏥',
  'اختبار': '🔬',
};

export function DetailedAppointmentsTable({
  appointments,
  patients,
  profiles,
  onEdit,
  onDelete,
  searchTerm = '',
  onSearchChange,
}: DetailedAppointmentsTableProps) {
  const { t, lang, dir } = useLanguage();
  const locale = lang === 'fr' ? 'fr-FR' : 'ar-DZ';
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState(searchTerm);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const getPatientName = (id: string) => {
    return patients.find(p => p.id === id)?.full_name || 'Unknown';
  };

  const getPatientPhone = (id: string) => {
    return patients.find(p => p.id === id)?.phone || '-';
  };

  const getDoctorName = (id: string) => {
    return profiles.find(p => p.id === id)?.full_name || 'Unknown';
  };

  const getDoctorRole = (id: string) => {
    return profiles.find(p => p.id === id)?.role || 'doctor';
  };

  const getDoctorImage = (id: string) => {
    const profile = profiles.find(p => p.id === id);
    return profile?.profile_image_url || getRoleImage(profile?.role || 'doctor');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(locale, { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: lang === 'ar'
    });
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const searchLower = localSearch.toLowerCase();
      const patientName = getPatientName(apt.patient_id).toLowerCase();
      const doctorName = getDoctorName(apt.doctor_id).toLowerCase();
      
      const matchesSearch = 
        patientName.includes(searchLower) ||
        doctorName.includes(searchLower) ||
        apt.date.toLowerCase().includes(searchLower) ||
        apt.type.toLowerCase().includes(searchLower);
      
      const matchesStatus = !filterStatus || apt.status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [appointments, localSearch, filterStatus, patients, profiles]);

  const handleSearch = (value: string) => {
    setLocalSearch(value);
    onSearchChange?.(value);
  };

  if (filteredAppointments.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <p className="text-muted-foreground font-cairo">{t.noAppointments}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.searchAppointments}
            value={localSearch}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 font-cairo"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-input bg-background font-cairo"
        >
          <option value="">All Status</option>
          <option value="مجدول">Scheduled</option>
          <option value="مكتمل">Completed</option>
          <option value="ملغي">Cancelled</option>
          <option value="غائب">Absent</option>
        </select>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Date & Time</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Patient</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Doctor</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Notes</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <AnimatePresence>
              {filteredAppointments.map((apt) => (
                <motion.tr
                  key={apt.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary/60" />
                      <div className="text-sm">
                        <div className="font-medium">{formatDate(apt.date)}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(apt.date)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="font-medium">{getPatientName(apt.patient_id)}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" />
                        {getPatientPhone(apt.patient_id)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div className={`h-8 w-8 rounded-lg bg-gradient-to-r ${getRoleColors(getDoctorRole(apt.doctor_id)).gradient} flex items-center justify-center shrink-0 overflow-hidden`}>
                        <img src={getDoctorImage(apt.doctor_id)} alt="Doctor" className="w-full h-full object-cover" />
                      </div>
                      <div className="font-medium">{getDoctorName(apt.doctor_id)}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <span>{typeEmojis[apt.type] || '📝'}</span>
                      <span className="ml-2">{apt.type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[apt.status] || ''}`}>
                      {apt.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-muted-foreground max-w-xs truncate">
                      {apt.notes ? (
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {apt.notes}
                        </div>
                      ) : (
                        '-'
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onEdit(apt)}
                        className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                      >
                        <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </button>
                      <button
                        onClick={() => onDelete(apt.id)}
                        className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        <AnimatePresence>
          {filteredAppointments.map((apt) => (
            <motion.div
              key={apt.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border rounded-lg p-4 bg-background hover:bg-muted/50 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold">{getPatientName(apt.patient_id)}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(apt.date)}
                  </div>
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === apt.id ? null : apt.id)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <ChevronDown
                    className={`h-5 w-5 transition-transform ${expandedId === apt.id ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Time:</span>
                  <div className="font-medium flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(apt.date)}
                  </div>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[apt.status] || ''}`}>
                      {apt.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expandable Details */}
              <AnimatePresence>
                {expandedId === apt.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t pt-3 space-y-2 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg bg-gradient-to-r ${getRoleColors(getDoctorRole(apt.doctor_id)).gradient} flex items-center justify-center shrink-0 overflow-hidden`}>
                        <img src={getDoctorImage(apt.doctor_id)} alt="Doctor" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <span className="text-muted-foreground">Doctor:</span>
                        <div className="font-medium">{getDoctorName(apt.doctor_id)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary/60" />
                      <div>
                        <span className="text-muted-foreground">Patient Phone:</span>
                        <div className="font-medium">{getPatientPhone(apt.patient_id)}</div>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <div className="font-medium mt-1">
                        {typeEmojis[apt.type] || '📝'} {apt.type}
                      </div>
                    </div>
                    {apt.notes && (
                      <div>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          Notes:
                        </span>
                        <div className="font-medium mt-1 p-2 bg-muted rounded text-xs">
                          {apt.notes}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-3 border-t">
                      <button
                        onClick={() => onEdit(apt)}
                        className="flex-1 px-3 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(apt.id)}
                        className="flex-1 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground text-center pt-2">
        Showing {filteredAppointments.length} of {appointments.length} appointments
      </div>
    </div>
  );
}
