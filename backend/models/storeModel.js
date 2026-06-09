function buildHealthPayload(state) {
  return {
    ok: true,
    dbConfigured: state.ready,
    ...(state.ready ? {} : { dbError: state.error }),
  };
}

function buildVendorStatusPayload(vendor, approval) {
  return {
    id: vendor.id,
    status: approval.label,
    statusKey: approval.code,
    approval,
  };
}

function buildDeletedVendorPayload(vendor, vendorId, deletedProductCount) {
  return {
    message: 'Vendor deleted successfully.',
    vendorId,
    deletedProductCount,
    vendorStatus:
      String(vendor.approval_status || '').toLowerCase() === 'approved'
        ? 'Approved'
        : 'Pending Approval',
  };
}

module.exports = {
  buildHealthPayload,
  buildVendorStatusPayload,
  buildDeletedVendorPayload,
};
