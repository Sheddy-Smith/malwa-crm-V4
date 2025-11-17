import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { toast } from 'sonner';
import { PlusCircle, Trash2, Plus } from 'lucide-react';
import { dbOperations } from '@/lib/db';

const PurchaseInvoiceForm = ({ onClose, onSave }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    gst_type: 'igst',
    igst: 18,
    cgst: 9,
    sgst: 9,
  });
  const [materials, setMaterials] = useState([
    {
      id: Date.now(),
      material_name: '',
      category_id: '',
      quantity: '',
      unit: 'pcs',
      rate: '',
    }
  ]);

  useEffect(() => {
    loadSuppliers();
    loadCategories();
  }, []);

  const loadSuppliers = async () => {
    try {
      const data = await dbOperations.getAll('suppliers');
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await dbOperations.getAll('inventory_categories');
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleMaterialChange = (id, field, value) => {
    setMaterials(materials.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const addMaterialRow = () => {
    setMaterials([...materials, {
      id: Date.now(),
      material_name: '',
      category_id: '',
      quantity: '',
      unit: 'pcs',
      rate: '',
    }]);
  };

  const removeMaterialRow = (id) => {
    if (materials.length > 1) {
      setMaterials(materials.filter(item => item.id !== id));
    }
  };

  const calculateMaterialTotal = (quantity, rate) => {
    return (parseFloat(quantity) || 0) * (parseFloat(rate) || 0);
  };

  const calculateTotals = () => {
    const subtotal = materials.reduce((sum, item) => 
      sum + calculateMaterialTotal(item.quantity, item.rate), 0
    );

    let gstAmount = 0;
    if (formData.gst_type === 'igst') {
      gstAmount = (subtotal * parseFloat(formData.igst)) / 100;
    } else {
      const cgstAmount = (subtotal * parseFloat(formData.cgst)) / 100;
      const sgstAmount = (subtotal * parseFloat(formData.sgst)) / 100;
      gstAmount = cgstAmount + sgstAmount;
    }

    const total = subtotal + gstAmount;

    return {
      subtotal: subtotal.toFixed(2),
      gstAmount: gstAmount.toFixed(2),
      total: total.toFixed(2),
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.invoice_no) {
      toast.error('Invoice number is required');
      return;
    }
    if (!formData.supplier_id) {
      toast.error('Please select a supplier');
      return;
    }

    // Validate materials
    const validMaterials = materials.filter(m => m.material_name && m.category_id && m.quantity && m.rate);
    if (validMaterials.length === 0) {
      toast.error('Please add at least one material with all required fields');
      return;
    }

    const amounts = calculateTotals();
    const selectedSupplier = suppliers.find(s => s.id === formData.supplier_id);

    const purchaseData = {
      ...formData,
      supplier_name: selectedSupplier?.name || '',
      materials: validMaterials,
      subtotal: parseFloat(amounts.subtotal),
      gst_amount: parseFloat(amounts.gstAmount),
      total_amount: parseFloat(amounts.total),
      created_at: new Date().toISOString(),
    };

    onSave(purchaseData);
  };

  const totals = calculateTotals();
  const selectedSupplier = suppliers.find(s => s.id === formData.supplier_id);

  return (
    <div className="max-h-[85vh] overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text mb-4">
        Add Purchase Invoice
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Invoice Header */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
              Invoice No *
            </label>
            <input
              type="text"
              name="invoice_no"
              value={formData.invoice_no}
              onChange={handleChange}
              placeholder="Enter invoice number"
              className="w-full p-2 border border-gray-300 rounded-lg bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-2 focus:ring-brand-red"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
              Date *
            </label>
            <input
              type="date"
              name="invoice_date"
              value={formData.invoice_date}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-2 focus:ring-brand-red"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
              Supplier *
            </label>
            <select
              name="supplier_id"
              value={formData.supplier_id}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-2 focus:ring-brand-red"
              required
            >
              <option value="">Select Supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} {supplier.company && `- ${supplier.company}`}
                </option>
              ))}
            </select>
            {selectedSupplier?.gstin && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                GSTIN: {selectedSupplier.gstin}
              </p>
            )}
          </div>
        </div>

        {/* Materials Table */}
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase" style={{width: '25%'}}>Material Name *</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase" style={{width: '20%'}}>Category *</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase" style={{width: '12%'}}>Quantity *</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase" style={{width: '12%'}}>Unit</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase" style={{width: '15%'}}>Rate *</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase" style={{width: '13%'}}>Total</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase" style={{width: '3%'}}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {materials.map((material) => (
                  <tr key={material.id} className="bg-white dark:bg-dark-card">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={material.material_name}
                        onChange={(e) => handleMaterialChange(material.id, 'material_name', e.target.value)}
                        placeholder="Enter material name"
                        className="w-full p-1.5 text-sm border border-gray-300 rounded bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-1 focus:ring-brand-red"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={material.category_id}
                        onChange={(e) => handleMaterialChange(material.id, 'category_id', e.target.value)}
                        className="w-full p-1.5 text-sm border border-gray-300 rounded bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-1 focus:ring-brand-red"
                      >
                        <option value="">Select</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={material.quantity}
                        onChange={(e) => handleMaterialChange(material.id, 'quantity', e.target.value)}
                        placeholder="0"
                        step="0.01"
                        min="0"
                        className="w-full p-1.5 text-sm border border-gray-300 rounded bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-1 focus:ring-brand-red"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={material.unit}
                        onChange={(e) => handleMaterialChange(material.id, 'unit', e.target.value)}
                        className="w-full p-1.5 text-sm border border-gray-300 rounded bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-1 focus:ring-brand-red"
                      >
                        <option value="pcs">Pieces</option>
                        <option value="kg">Kg</option>
                        <option value="ltr">Liters</option>
                        <option value="mtr">Meters</option>
                        <option value="box">Box</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={material.rate}
                        onChange={(e) => handleMaterialChange(material.id, 'rate', e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full p-1.5 text-sm border border-gray-300 rounded bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-1 focus:ring-brand-red"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
                        ₹{calculateMaterialTotal(material.quantity, material.rate).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeMaterialRow(material.id)}
                        disabled={materials.length === 1}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Button
          type="button"
          onClick={addMaterialRow}
          variant="outline"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Material
        </Button>

        {/* GST Section */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
              GST Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="gst_type"
                  value="igst"
                  checked={formData.gst_type === 'igst'}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-dark-text">IGST</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="gst_type"
                  value="cgst_sgst"
                  checked={formData.gst_type === 'cgst_sgst'}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-dark-text">CGST + SGST</span>
              </label>
            </div>
          </div>
          <div>
            {formData.gst_type === 'igst' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                  IGST Rate (%)
                </label>
                <input
                  type="number"
                  name="igst"
                  value={formData.igst}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-2 focus:ring-brand-red"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                    CGST (%)
                  </label>
                  <input
                    type="number"
                    name="cgst"
                    value={formData.cgst}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    max="100"
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-2 focus:ring-brand-red"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                    SGST (%)
                  </label>
                  <input
                    type="number"
                    name="sgst"
                    value={formData.sgst}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    max="100"
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-2 focus:ring-brand-red"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Amount Summary */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
            <span className="font-medium text-gray-900 dark:text-dark-text">₹{totals.subtotal}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              GST ({formData.gst_type === 'igst' ? `IGST ${formData.igst}%` : `CGST ${formData.cgst}% + SGST ${formData.sgst}%`}):
            </span>
            <span className="font-medium text-gray-900 dark:text-dark-text">₹{totals.gstAmount}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-gray-300 dark:border-gray-600 pt-2">
            <span className="text-gray-900 dark:text-dark-text">Total Amount:</span>
            <span className="text-brand-red">₹{totals.total}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save Purchase Invoice
          </Button>
        </div>
      </form>
    </div>
  );
};

const Purchase = () => {
  const [purchases, setPurchases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [searchFilters, setSearchFilters] = useState({
    invoice_no: '',
    supplier_id: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    loadPurchases();
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const data = await dbOperations.getAll('suppliers');
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const data = await dbOperations.getAll('purchases');
      setPurchases(data || []);
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchFilters({ ...searchFilters, [name]: value });
  };

  const filteredPurchases = purchases.filter((purchase) => {
    const matchesInvoiceNo = !searchFilters.invoice_no || 
      purchase.invoice_no?.toLowerCase().includes(searchFilters.invoice_no.toLowerCase());
    
    const matchesSupplier = !searchFilters.supplier_id || 
      purchase.supplier_id === searchFilters.supplier_id;
    
    const matchesDateFrom = !searchFilters.date_from || 
      purchase.invoice_date >= searchFilters.date_from;
    
    const matchesDateTo = !searchFilters.date_to || 
      purchase.invoice_date <= searchFilters.date_to;
    
    return matchesInvoiceNo && matchesSupplier && matchesDateFrom && matchesDateTo;
  });

  const handleSave = async (purchaseData) => {
    try {
      const purchaseId = Date.now().toString();
      
      // 1. Save main purchase invoice
      await dbOperations.insert('purchases', {
        id: purchaseId,
        invoice_no: purchaseData.invoice_no,
        invoice_date: purchaseData.invoice_date,
        supplier_id: purchaseData.supplier_id,
        supplier_name: purchaseData.supplier_name,
        gst_type: purchaseData.gst_type,
        igst: purchaseData.igst,
        cgst: purchaseData.cgst,
        sgst: purchaseData.sgst,
        subtotal: purchaseData.subtotal,
        gst_amount: purchaseData.gst_amount,
        total_amount: purchaseData.total_amount,
        created_at: purchaseData.created_at,
      });

      // 2. Save each material and update stock
      for (const material of purchaseData.materials) {
        const materialId = `${purchaseId}_${material.id}`;
        
        // Save purchase item
        await dbOperations.insert('purchase_items', {
          id: materialId,
          purchase_id: purchaseId,
          material_name: material.material_name,
          category_id: material.category_id,
          quantity: parseFloat(material.quantity),
          unit: material.unit,
          rate: parseFloat(material.rate),
          total: parseFloat(material.quantity) * parseFloat(material.rate),
          created_at: new Date().toISOString(),
        });

        // Update stock movement
        await dbOperations.insert('stock_movements', {
          id: `stock_${materialId}`,
          material_name: material.material_name,
          category_id: material.category_id,
          movement_type: 'in',
          quantity: parseFloat(material.quantity),
          unit: material.unit,
          reference_type: 'purchase',
          reference_id: purchaseId,
          reference_no: purchaseData.invoice_no,
          movement_date: purchaseData.invoice_date,
          created_at: new Date().toISOString(),
        });
      }

      // 3. Add to GST Ledger
      const gstId = `${purchaseId}_gst`;
      await dbOperations.insert('gst_ledger', {
        id: gstId,
        transaction_type: 'purchase',
        transaction_date: purchaseData.invoice_date,
        document_no: purchaseData.invoice_no,
        party_name: purchaseData.supplier_name,
        gst_type: purchaseData.gst_type,
        igst: purchaseData.gst_type === 'igst' ? purchaseData.gst_amount : 0,
        cgst: purchaseData.gst_type === 'cgst_sgst' ? purchaseData.gst_amount / 2 : 0,
        sgst: purchaseData.gst_type === 'cgst_sgst' ? purchaseData.gst_amount / 2 : 0,
        total_gst: purchaseData.gst_amount,
        taxable_amount: purchaseData.subtotal,
        entry_type: 'input',
        created_at: new Date().toISOString(),
      });

      toast.success(`Purchase invoice saved successfully! ${purchaseData.materials.length} materials added to stock.`);
      setShowForm(false);
      loadPurchases();
    } catch (error) {
      console.error('Error saving purchase:', error);
      toast.error('Failed to save purchase invoice');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this purchase invoice?')) {
      return;
    }

    try {
      await dbOperations.delete('purchases', id);
      toast.success('Purchase invoice deleted');
      loadPurchases();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      toast.error('Failed to delete purchase invoice');
    }
  };

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
            Purchase Invoices
          </h2>
          <Button
            onClick={() => setShowForm(true)}
            variant="primary"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Add Purchase Invoice
          </Button>
        </div>

        {/* Search Filters */}
        <div className="grid grid-cols-4 gap-3 mb-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <input
              type="text"
              name="invoice_no"
              value={searchFilters.invoice_no}
              onChange={handleSearchChange}
              placeholder="Search by Invoice No..."
              className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-2 focus:ring-brand-red"
            />
          </div>
          <div>
            <select
              name="supplier_id"
              value={searchFilters.supplier_id}
              onChange={handleSearchChange}
              className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-2 focus:ring-brand-red"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="date"
              name="date_from"
              value={searchFilters.date_from}
              onChange={handleSearchChange}
              placeholder="From Date"
              className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-2 focus:ring-brand-red"
            />
          </div>
          <div>
            <input
              type="date"
              name="date_to"
              value={searchFilters.date_to}
              onChange={handleSearchChange}
              placeholder="To Date"
              className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:ring-2 focus:ring-brand-red"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {purchases.length === 0 ? 'No purchase invoices found' : 'No matching purchase invoices found'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              {purchases.length === 0 ? 'Add your first purchase invoice to get started' : 'Try adjusting your search filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Invoice No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Materials</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">GST</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-dark-text">{purchase.invoice_no}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-dark-text">
                      {new Date(purchase.invoice_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-dark-text">{purchase.supplier_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-dark-text">
                      {purchase.material_name || 'Multiple items'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-dark-text">₹{purchase.gst_amount?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-dark-text">
                      ₹{purchase.total_amount?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleDelete(purchase.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} size="xl">
        <PurchaseInvoiceForm
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      </Modal>
    </div>
  );
};

export default Purchase;
