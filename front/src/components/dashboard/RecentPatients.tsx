import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateValue, patientStatusMap } from "@/lib/translationMaps";

const patients = [
  { id: 1, name: "أحمد بن علي", age: 34, center: "serviceMentalHealth", status: "تحسن", doctor: "د. محمد" },
  { id: 2, name: "فاطمة الزهراء", age: 12, center: "servicePediatrics", status: "استقرار", doctor: "د. سارة" },
  { id: 3, name: "يوسف كريم", age: 45, center: "serviceEmergency", status: "تدهور", doctor: "د. خالد" },
  { id: 4, name: "مريم حسني", age: 28, center: "serviceMentalHealth", status: "تحسن", doctor: "د. أمين" },
  { id: 5, name: "عبد الرحمن", age: 19, center: "servicePediatrics", status: "استقرار", doctor: "د. سارة" },
];

const statusStyleKeys: Record<string, string> = {
  "تحسن": "gradient-success text-primary-foreground",
  "استقرار": "bg-primary/20 text-primary",
  "تدهور": "bg-destructive/20 text-destructive",
};

export const RecentPatients = () => {
  const { t } = useLanguage();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="neu-flat rounded-3xl bg-background p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold font-cairo">{t.recentPatients}</h3>
        <button className="text-sm text-primary font-medium font-cairo hover:underline">{t.viewAll}</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground font-cairo">
              <th className="text-right pb-4 font-medium">{t.thName}</th>
              <th className="text-right pb-4 font-medium">{t.thAge}</th>
              <th className="text-right pb-4 font-medium">{t.thCenter}</th>
              <th className="text-right pb-4 font-medium">{t.thDoctor}</th>
              <th className="text-right pb-4 font-medium">{t.thStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {patients.map((patient) => (
              <tr key={patient.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-3.5 font-medium font-cairo">{patient.name}</td>
                <td className="py-3.5">{patient.age}</td>
                <td className="py-3.5 font-cairo text-muted-foreground">{(t as any)[patient.center] || patient.center}</td>
                <td className="py-3.5 font-cairo">{patient.doctor}</td>
                <td className="py-3.5">
                  <span className={`inline-block rounded-xl px-3 py-1 text-xs font-medium font-cairo ${statusStyleKeys[patient.status]}`}>
                    {translateValue(patient.status, patientStatusMap, t)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
