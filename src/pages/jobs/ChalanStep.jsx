import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Save, Printer, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import JobSearchBar from "@/components/jobs/JobSearchBar";
import JobReportList from "@/components/jobs/JobReportList";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { dbOperations } from "@/lib/db";
import { createStockMovement } from "@/utils/dataFlow";
import { toast } from "sonner";
import useMultiplierStore from "@/store/multiplierStore";

const ChalanStep = () => {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const data = await dbOperations.getAll('sell_challans');
      const sorted = (data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecords(sorted);
      setFilteredRecords(sorted);
    } catch (e) {
      console.error('Failed to load challans:', e);
    }
  };

  const handleSearch = (filters) => {
    let filtered = [...records];
    if (filters.vehicleNo) {
      filtered = filtered.filter(r => r.vehicle_no.toLowerCase().includes(filters.vehicleNo.toLowerCase()));
    }
    if (filters.partyName) {
      filtered = filtered.filter(r => r.party_name.toLowerCase().includes(filters.partyName.toLowerCase()));
    }
    if (filters.dateFrom) {
      filtered = filtered.filter(r => r.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filtered = filtered.filter(r => r.date <= filters.dateTo);
    }
    setFilteredRecords(filtered);
  };

  const handleReset = () => {
    setFilteredRecords(records);
  };

  const handleEditRecord = (record) => {
    toast.info('Load record feature coming soon');
  };

  const handleDeleteRecord = async (id) => {
    try {
      await dbOperations.delete('sell_challans', id);
      toast.success('Challan deleted successfully');
      await loadRecords();
      setDeleteConfirmId(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete challan');
    }
  };
  const [jobSheetEstimate, setJobSheetEstimate] = useState([]);
  const [extraWork, setExtraWork] = useState([]);
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    const estimateData = JSON.parse(localStorage.getItem("jobSheetEstimate") || "[]");
    const extraData = JSON.parse(localStorage.getItem("extraWork") || "[]");
    const disc = parseFloat(localStorage.getItem("estimateDiscount")) || 0;

    setJobSheetEstimate(estimateData);
    setExtraWork(extraData);
    setDiscount(disc);
  }, []);

  const { getCategoryMultiplier, getMultiplierByWorkType } = useMultiplierStore();

  const calculateTotal = (item) => {
    const cost = parseFloat(item.cost) || 0;
    let multiplier = 1;

    if (item.category) {
      multiplier = getCategoryMultiplier(item.category.trim());
    } else if (item.workBy) {
      multiplier = getMultiplierByWorkType(item.workBy);
    }

    return cost * multiplier;
  };

  const subTotalEstimate = jobSheetEstimate.reduce(
    (acc, item) => acc + calculateTotal(item),
    0
  );

  const subTotalExtra = extraWork.reduce(
    (acc, item) => acc + calculateTotal(item),
    0
  );

  const grandTotal = subTotalEstimate + subTotalExtra;
  const finalTotal = grandTotal - discount;

  // ✅ Delete entry from localStorage + UI
  const handleDelete = (type, index) => {
    if (type === "estimate") {
      const updated = jobSheetEstimate.filter((_, i) => i !== index);
      setJobSheetEstimate(updated);
      localStorage.setItem("jobSheetEstimate", JSON.stringify(updated));
    } else if (type === "extra") {
      const updated = extraWork.filter((_, i) => i !== index);
      setExtraWork(updated);
      localStorage.setItem("extraWork", JSON.stringify(updated));
    }
  };

  // ✅ Save as PDF
  const handleSavePDF = () => {
    const input = document.getElementById("challan-body");
    html2canvas(input, { scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("challan.pdf");
    });
  };

  // ✅ Persist challan to IndexedDB and create stock movements (OUT)
  const handlePersistChallan = async () => {
    try {
      const items = [...jobSheetEstimate, ...extraWork].map((item) => ({
        productName: item.item,
        qty: 1,
        rate: parseFloat(item.cost) || 0,
      }));

      const subtotal = items.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0), 0);
      const tax = 0;
      const total = subtotal - (discount || 0);

      const challan = await dbOperations.insert('sell_challans', {
        date: new Date().toISOString().split('T')[0],
        items,
        subtotal,
        tax,
        total,
        status: 'issued',
      });

      for (const it of items) {
        await createStockMovement(undefined, it.productName, 'out', it.qty || 0, 'sell-challan', { challanId: challan.id });
      }

      toast.success('Challan saved and stock updated');
      await loadRecords();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save challan');
    }
  };

  // ✅ Print
  const handlePrint = () => {
    const printContent = document.getElementById("challan-body");
    const WinPrint = window.open("", "", "width=900,height=650");
    WinPrint.document.write(
      `<html><head><title>Challan</title></head><body>${printContent.innerHTML}</body></html>`
    );
    WinPrint.document.close();
    WinPrint.focus();
    WinPrint.print();
    WinPrint.close();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">Challan</h3>

      <Card>
        <div id="challan-body">
          <h4 className="font-semibold mb-2">Tasks from Job Sheet</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">Category</th>
                  <th className="p-2 border">Item</th>
                  <th className="p-2 border">Condition</th>
                  <th className="p-2 border">Cost (₹)</th>
                  <th className="p-2 border">Total (₹)</th>
                  <th className="p-2 border">Work By</th>
                  <th className="p-2 border">Notes</th>
                  <th className="p-2 border text-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {/* Estimate Data */}
                {jobSheetEstimate.map((item, idx) => {
                  const multiplier = item.category ? getCategoryMultiplier(item.category.trim()) : (item.workBy ? getMultiplierByWorkType(item.workBy) : 1);
                  return (
                    <tr key={`est-${idx}`} className="border-b">
                      <td className="p-2">
                        {item.category}
                        <span className="text-xs text-gray-500 ml-1">({multiplier}x)</span>
                      </td>
                      <td className="p-2">{item.item}</td>
                      <td className="p-2">{item.condition}</td>
                      <td className="p-2">₹{item.cost}</td>
                      <td className="p-2 font-semibold">₹{calculateTotal(item).toFixed(2)}</td>
                      <td className="p-2">{item.workBy || "Labour"}</td>
                      <td className="p-2">{item.notes || ""}</td>
                      <td className="p-2 text-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete("estimate", idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {/* Extra Work Data */}
                {extraWork.map((item, idx) => {
                  const multiplier = item.category ? getCategoryMultiplier(item.category.trim()) : (item.workBy ? getMultiplierByWorkType(item.workBy) : 1);
                  return (
                    <tr key={`extra-${idx}`} className="border-b">
                      <td className="p-2">
                        {item.category}
                        <span className="text-xs text-gray-500 ml-1">({multiplier}x)</span>
                      </td>
                      <td className="p-2">{item.item}</td>
                      <td className="p-2">{item.condition}</td>
                      <td className="p-2">₹{item.cost}</td>
                      <td className="p-2 font-semibold">₹{calculateTotal(item).toFixed(2)}</td>
                      <td className="p-2">{item.workBy || "Labour"}</td>
                      <td className="p-2">{item.notes || ""}</td>
                      <td className="p-2 text-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete("extra", idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-4 text-right font-semibold">
              <div>Subtotal (Estimate): ₹{subTotalEstimate.toFixed(2)}</div>
              <div>Subtotal (Extra Work): ₹{subTotalExtra.toFixed(2)}</div>
              <div>Estimate Discount: ₹{discount.toFixed(2)}</div>
              <div className="font-bold text-lg">Grand Total: ₹{finalTotal.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-4">
          <Button variant="secondary" onClick={handleSavePDF}>
            <Save className="h-4 w-4 mr-2" /> Save Challan
          </Button>
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Print Challan
          </Button>
          <Button onClick={handlePersistChallan}>
            <Save className="h-4 w-4 mr-2" /> Post Challan (Stock OUT)
          </Button>
        </div>
      </Card>

      <JobSearchBar onSearch={handleSearch} onReset={handleReset} />

      <JobReportList
        records={filteredRecords}
        onEdit={handleEditRecord}
        onDelete={(id) => setDeleteConfirmId(id)}
        stepName="Chalan"
      />

      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => handleDeleteRecord(deleteConfirmId)}
        title="Delete Chalan"
        message="Are you sure you want to delete this chalan record? This action cannot be undone."
      />
    </div>
  );
};

export default ChalanStep;
