





import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Save, Printer } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import JobSearchBar from "@/components/jobs/JobSearchBar";
import JobReportList from "@/components/jobs/JobReportList";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { dbOperations } from "@/lib/db";
import { createLedgerEntry } from "@/utils/dataFlow";
import { toast } from "sonner";
import useMultiplierStore from "@/store/multiplierStore";

const InvoiceStep = () => {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [jobCtx, setJobCtx] = useState({ vehicleNo: "", partyName: "", contactNo: "" });
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    loadRecords();
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await dbOperations.getAll('customers');
      setCustomers(data || []);
    } catch (e) {
      console.error('Failed to load customers:', e);
    }
  };

  const loadRecords = async () => {
    try {
      const data = await dbOperations.getAll('invoices');
      const sorted = (data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecords(sorted);
      setFilteredRecords(sorted);
    } catch (e) {
      console.error('Failed to load invoices:', e);
    }
  };

  const handleSearch = (filters) => {
    let filtered = [...records];
    if (filters.vehicleNo) {
      filtered = filtered.filter(r => r.vehicle_no && r.vehicle_no.toLowerCase().includes(filters.vehicleNo.toLowerCase()));
    }
    if (filters.partyName) {
      filtered = filtered.filter(r => r.party_name && r.party_name.toLowerCase().includes(filters.partyName.toLowerCase()));
    }
    if (filters.dateFrom) {
      filtered = filtered.filter(r => r.date && r.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filtered = filtered.filter(r => r.date && r.date <= filters.dateTo);
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
      await dbOperations.delete('invoices', id);
      toast.success('Invoice deleted successfully');
      await loadRecords();
      setDeleteConfirmId(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete invoice');
    }
  };
  // Job Sheet data (static)
  const jobSheetEstimate = JSON.parse(localStorage.getItem("jobSheetEstimate") || "[]");
  const extraWork = JSON.parse(localStorage.getItem("extraWork") || "[]");
  useEffect(() => {
    try {
      const raw = localStorage.getItem('jobsContext');
      if (raw) setJobCtx(JSON.parse(raw));
    } catch {}
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

  const subTotal = subTotalEstimate + subTotalExtra;

  const [customer, setCustomer] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [paymentType, setPaymentType] = useState("Full Payment");
  const [gstType, setGstType] = useState("IGST"); // IGST or CGST+SGST
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState(null);
  const [roundOff, setRoundOff] = useState(0);

  const discount = parseFloat(localStorage.getItem("estimateDiscount") || 0);
  
  // Convert number to words
  const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    if (num === 0) return 'Zero';
    
    const convertHundreds = (n) => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertHundreds(n % 100) : '');
    };
    
    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const hundred = num % 1000;
    
    let result = '';
    if (crore) result += convertHundreds(crore) + ' Crore ';
    if (lakh) result += convertHundreds(lakh) + ' Lakh ';
    if (thousand) result += convertHundreds(thousand) + ' Thousand ';
    if (hundred) result += convertHundreds(hundred);
    
    return result.trim() + ' Rupees Only';
  };
  
  // GST Calculation based on type
  const gstRate = 18; // Total GST is always 18%
  const cgstRate = 9;
  const sgstRate = 9;
  const igstRate = 18;
  
  const gstAmount = (subTotal * gstRate) / 100;
  const cgstAmount = gstType === "CGST+SGST" ? (subTotal * cgstRate) / 100 : 0;
  const sgstAmount = gstType === "CGST+SGST" ? (subTotal * sgstRate) / 100 : 0;
  const igstAmount = gstType === "IGST" ? (subTotal * igstRate) / 100 : 0;
  
  const grandTotal = subTotal + gstAmount;
  const totalAfterDiscount = grandTotal - discount;
  const finalTotal = totalAfterDiscount + parseFloat(roundOff || 0);

  // PDF download
  const handleSavePDF = () => {
    const input = document.getElementById("invoice-body");
    html2canvas(input, { scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      const filename = jobCtx.vehicleNo ? `${jobCtx.vehicleNo}_invoice.pdf` : "invoice.pdf";
      pdf.save(filename);
    });
  };

  // Print
  const handlePrint = () => {
    const printContent = document.getElementById("invoice-body");
    const WinPrint = window.open("", "", "width=900,height=650");
    WinPrint.document.write(`<html><head><title>Invoice</title></head><body>${printContent.innerHTML}</body></html>`);
    WinPrint.document.close();
    WinPrint.focus();
    WinPrint.print();
    WinPrint.close();
  };








const handleSaveInvoice = async () => {
  try {
    if (!customer) {
      toast.error('Please select or enter a customer');
      return;
    }

    const allItems = [...jobSheetEstimate, ...extraWork].map(item => ({
      category: item.category,
      item: item.item,
      condition: item.condition,
      cost: parseFloat(item.cost) || 0,
      total: calculateTotal(item),
    }));

    const date = new Date().toISOString().split('T')[0];
    const subtotal = allItems.reduce((s, i) => s + (i.total || 0), 0);
    
    // Calculate GST based on type
    const gstAmt = (subtotal * 18) / 100;
    const cgst = gstType === "CGST+SGST" ? (subtotal * 9) / 100 : 0;
    const sgst = gstType === "CGST+SGST" ? (subtotal * 9) / 100 : 0;
    const igst = gstType === "IGST" ? (subtotal * 18) / 100 : 0;
    
    const totalAfterDisc = subtotal + gstAmt - (discount || 0);
    const final = totalAfterDisc + parseFloat(roundOff || 0);

    // Get customer details
    let customerId = customer;
    let customerName = customer;
    
    if (!isNewCustomer) {
      const selectedCustomer = customers.find(c => c.id === customer);
      if (selectedCustomer) {
        customerName = selectedCustomer.name;
      }
    }

    const invoiceData = {
      date,
      vehicle_no: jobCtx.vehicleNo || undefined,
      party_name: jobCtx.partyName || undefined,
      customer_id: !isNewCustomer ? customerId : undefined,
      customer_name: customerName,
      payment_type: paymentType,
      items: allItems,
      subtotal,
      gst_type: gstType,
      cgst: cgst,
      sgst: sgst,
      igst: igst,
      tax: gstAmt,
      discount: discount || 0,
      round_off: parseFloat(roundOff || 0),
      total: final,
      status: 'pending',
    };

    // Save to invoices table
    const invoice = await dbOperations.insert('invoices', invoiceData);

    // Also save to sell_challans table for consistency
    await dbOperations.insert('sell_challans', {
      date,
      vehicle_no: jobCtx.vehicleNo || undefined,
      party_name: jobCtx.partyName || undefined,
      customer_name: customerName,
      items: allItems,
      subtotal,
      gst_type: gstType,
      cgst: cgst,
      sgst: sgst,
      igst: igst,
      tax: gstAmt,
      discount: discount || 0,
      total: final,
      status: 'invoiced',
      invoice_id: invoice.id,
    });

    // Create ledger entry if customer exists
    if (!isNewCustomer && customerId) {
      try {
        await dbOperations.insert('customer_ledger_entries', {
          customer_id: customerId,
          entry_date: date,
          type: 'invoice',
          description: `Invoice for Vehicle: ${jobCtx.vehicleNo || 'N/A'}`,
          debit: final,
          credit: 0,
          reference_type: 'invoice',
          reference_id: invoice.id,
        });
      } catch (ledgerError) {
        console.error('Failed to create ledger entry:', ledgerError);
      }
    }

    toast.success('Invoice saved successfully');
    await loadRecords();
  } catch (e) {
    console.error(e);
    toast.error('Failed to save invoice');
  }
};








  return (
    <div className="space-y-4 p-4">
      <h3 className="text-xl font-bold">Invoice</h3>
      {(jobCtx.vehicleNo || jobCtx.partyName) && (
        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="text-sm">Vehicle: <span className="font-semibold">{jobCtx.vehicleNo}</span></div>
          <div className="text-sm">Party: <span className="font-semibold">{jobCtx.partyName}</span></div>
        </div>
      )}

      <Card>
        {/* Customer & Payment Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="font-semibold">Customer</label>
            {!isNewCustomer ? (
              <select
                value={customer}
                onChange={(e) => {
                  setCustomer(e.target.value);
                  const selectedCust = customers.find(c => c.id === e.target.value);
                  setSelectedCustomerDetails(selectedCust || null);
                }}
                className="w-full border p-2 rounded mt-1"
              >
                <option value="">Select Customer</option>
                {customers.map((cust) => (
                  <option key={cust.id} value={cust.id}>
                    {cust.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Enter new customer"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="w-full border p-2 rounded mt-1"
              />
            )}
            <div className="mt-2">
              <button
                className="text-sm text-blue-500 underline"
                onClick={() => setIsNewCustomer(!isNewCustomer)}
              >
                {isNewCustomer ? "Select Existing" : "Add New Customer"}
              </button>
            </div>
          </div>

          <div>
            <label className="font-semibold">Payment Type</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              className="w-full border p-2 rounded mt-1"
            >
              <option>Full Payment</option>
              <option>Advance Payment</option>
              <option>Partial Payment</option>
            </select>
          </div>

          <div>
            <label className="font-semibold">Round Off (₹)</label>
            <input
              type="number"
              step="0.01"
              value={roundOff}
              onChange={(e) => setRoundOff(e.target.value)}
              className="w-full border p-2 rounded mt-1"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="font-semibold">GST Type</label>
            <select
              value={gstType}
              onChange={(e) => setGstType(e.target.value)}
              className="w-full border p-2 rounded mt-1"
            >
              <option value="IGST">IGST 18%</option>
              <option value="CGST+SGST">CGST 9% + SGST 9%</option>
            </select>
          </div>
        </div>

        {/* Invoice Body */}
        <div id="invoice-body" className="bg-white -mx-4 md:-mx-6 lg:-mx-8">
          {/* Header Image */}
          <div className="mb-4">
            <img 
              src="/Invoice_header.png" 
              alt="Invoice Header" 
              className="w-full"
              style={{ objectFit: 'cover', width: '100%' }}
              onError={(e) => {
                e.target.style.display = 'none';
                console.log('Invoice header image not found');
              }}
            />
          </div>

          <div className="px-4 md:px-6 lg:px-8">
          {/* Customer Details */}
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div className="border p-3">
              <h5 className="font-bold mb-2">BILL TO:</h5>
              <div><strong>Name:</strong> {selectedCustomerDetails?.name || customer || 'N/A'}</div>
              <div><strong>Contact:</strong> {selectedCustomerDetails?.phone || jobCtx.contactNo || 'N/A'}</div>
              <div><strong>Address:</strong> {selectedCustomerDetails?.address || 'N/A'}</div>
              <div><strong>GST No:</strong> {selectedCustomerDetails?.gstin || 'N/A'}</div>
            </div>
            <div className="border p-3">
              <div><strong>Invoice Date:</strong> {new Date().toLocaleDateString('en-IN')}</div>
              <div><strong>Vehicle No:</strong> {jobCtx.vehicleNo || 'N/A'}</div>
              <div><strong>Payment Type:</strong> {paymentType}</div>
            </div>
          </div>
          
          <h4 className="font-semibold mb-2">ITEMS</h4>
          <table className="w-full text-sm border border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">S.No</th>
                <th className="p-2 border">Category</th>
                <th className="p-2 border">Item</th>
                <th className="p-2 border">Condition</th>
                <th className="p-2 border">Cost (₹)</th>
                <th className="p-2 border">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {jobSheetEstimate.map((item, idx) => (
                <tr key={`est-${idx}`} className="border-b">
                  <td className="p-2 border text-center">{idx + 1}</td>
                  <td className="p-2 border">{item.category}</td>
                  <td className="p-2 border">{item.item}</td>
                  <td className="p-2 border">{item.condition}</td>
                  <td className="p-2 border text-right">{item.cost}</td>
                  <td className="p-2 border text-right">{calculateTotal(item).toFixed(2)}</td>
                </tr>
              ))}
              {extraWork.map((item, idx) => (
                <tr key={`extra-${idx}`} className="border-b">
                  <td className="p-2 border text-center">{jobSheetEstimate.length + idx + 1}</td>
                  <td className="p-2 border">{item.category}</td>
                  <td className="p-2 border">{item.item}</td>
                  <td className="p-2 border">{item.condition}</td>
                  <td className="p-2 border text-right">{item.cost}</td>
                  <td className="p-2 border text-right">{calculateTotal(item).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Section */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            {/* Left side - Amount in Words and Account Details */}
            <div className="text-sm">
              <div className="font-semibold mb-2">Amount in Words:</div>
              <div className="italic mb-4">{numberToWords(Math.round(finalTotal))}</div>
              
              {/* Account Details */}
              <div className="mt-4 pt-4 border-t">
                <div className="font-semibold mb-2">Account Details:</div>
                <div><strong>MALWA TROLLEY</strong></div>
                <div>ACC. NO.: 917020005504917</div>
                <div>IFSC: UTIB0002512</div>
                <div>AXIS BANK PALDA INDORE</div>
              </div>
            </div>
            
            {/* Right side - Totals and Signature */}
            <div>
              <div className="text-sm">
                <div className="flex justify-between border-b py-1">
                  <span>Subtotal:</span>
                  <span>₹{subTotal.toFixed(2)}</span>
                </div>
                {gstType === "IGST" ? (
                  <div className="flex justify-between border-b py-1">
                    <span>IGST (18%):</span>
                    <span>₹{igstAmount.toFixed(2)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between border-b py-1">
                      <span>CGST (9%):</span>
                      <span>₹{cgstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b py-1">
                      <span>SGST (9%):</span>
                      <span>₹{sgstAmount.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-b py-1">
                  <span>Discount:</span>
                  <span>₹{discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b py-1">
                  <span>Round Off:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={roundOff}
                    onChange={(e) => setRoundOff(e.target.value)}
                    className="w-20 border px-2 py-1 text-right text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-between font-bold text-lg py-2 border-t-2">
                  <span>Grand Total:</span>
                  <span>₹{finalTotal.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Authorized Signature */}
              <div className="mt-8 text-right">
                <div className="inline-block border-t border-black pt-2 px-8">
                  <div className="font-semibold">Authorized Signature</div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-4 mt-4">
          <Button onClick={handleSavePDF}>
            <Save className="h-4 w-4 mr-2" /> Save Invoice
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Print Invoice
          </Button>
          <Button onClick={handleSaveInvoice}>
            <Save className="h-4 w-4 mr-2" /> Save Invoice (Ledger)
          </Button>

        </div>
      </Card>

      <JobSearchBar onSearch={handleSearch} onReset={handleReset} />

      <JobReportList
        records={filteredRecords}
        onEdit={handleEditRecord}
        onDelete={(id) => setDeleteConfirmId(id)}
        stepName="Invoice"
      />

      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => handleDeleteRecord(deleteConfirmId)}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice record? This action cannot be undone."
      />
    </div>
  );
};

export default InvoiceStep;









