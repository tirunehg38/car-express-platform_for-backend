const InquiriesService = require("../services/inquiries.service");

const list = async (req, res) => {
  const data = await InquiriesService.list(req.query, req.user);
  return res.status(200).json({
    success: true,
    message: "Inquiries retrieved successfully",
    data,
  });
};

const getById = async (req, res) => {
  const inquiry = await InquiriesService.getById(req.params.id, req.user);
  return res.status(200).json({
    success: true,
    message: "Inquiry retrieved successfully",
    data: inquiry,
  });
};

const create = async (req, res) => {
  const inquiry = await InquiriesService.create(req.body, req.user || null);
  return res.status(201).json({
    success: true,
    message: "Inquiry submitted successfully",
    data: inquiry,
  });
};

const update = async (req, res) => {
  const inquiry = await InquiriesService.update(req.params.id, req.body, req.user);
  return res.status(200).json({
    success: true,
    message: "Inquiry updated successfully",
    data: inquiry,
  });
};

const remove = async (req, res) => {
  await InquiriesService.remove(req.params.id, req.user);
  return res.status(200).json({
    success: true,
    message: "Inquiry deleted successfully",
    data: null,
  });
};

const updateStatus = async (req, res) => {
  const inquiry = await InquiriesService.updateStatus(
    req.params.id,
    req.body.status,
    req.user
  );
  return res.status(200).json({
    success: true,
    message: "Inquiry status updated successfully",
    data: inquiry,
  });
};

module.exports = { list, getById, create, update, updateStatus, remove };
