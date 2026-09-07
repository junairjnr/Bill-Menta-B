import companyModel from "./company.model.js";
import ApiError from "../../utils/ApiError.js";

const getAllCompanies = async () => {
  const companies = await companyModel.find().select("-__v");
  if (!companies || companies.length === 0) {
    return [];
  }
  return companies;
};

const createCompany = async ({ name, code, address, contactEmail }) => {
  const exists = await companyModel.findOne({ $or: [{ name }, { code }] });
  if (exists) throw new ApiError(409, "Company name or code already exists");

  const company = await companyModel.create({
    name,
    code,
    address,
    contactEmail,
  });

  return company;
};

const getCompanyDetails = async (companyId) => {
  const company = await companyModel
    .findById(companyId)
    .select("-createdAt -updatedAt");
  if (!company) throw new ApiError(404, "Company not found");
  return company;
};

const updateCompanyDetails = async (
  companyId,
  { name, code, address, contactEmail }
) => {
  const company = await companyModel.findById(companyId);
  if (!company) throw new ApiError(404, "Company not found");

  // Check for name/code uniqueness if changed
  if (name && name !== company.name) {
    const exists = await companyModel.findOne({ name });
    if (exists) throw new ApiError(409, "Company name already exists");
    company.name = name;
  }
  if (code && code !== company.code) {
    const exists = await companyModel.findOne({ code });
    if (exists) throw new ApiError(409, "Company code already exists");
    company.code = code;
  }

  if (address) company.address = address;
  if (contactEmail) company.contactEmail = contactEmail;

  await company.save();
  return company;
};
export default {
  createCompany,
  getCompanyDetails,
  updateCompanyDetails,
  getAllCompanies,
};
