// import asyncHandler from "./asyncHandler.js";
// import ApiResponse from "./ApiResponse.js";
// import ApiError from "./ApiError.js";

// const crudFactory = (Model) => ({
//   getAll: asyncHandler(async (req, res) => {
//     const { page = 1, limit = 20, search = "", isActive } = req.query;
//     const filter = { companyId: req.companyId };

//     if (isActive !== undefined) filter.isActive = isActive === "true";
//     if (search) filter.name = { $regex: search, $options: "i" };

//     const skip = (page - 1) * limit;
//     const [data, total] = await Promise.all([
//       Model.find(filter)
//         .skip(skip)
//         .limit(Number(limit))
//         .sort({ createdAt: -1 }),
//       Model.countDocuments(filter),
//     ]);

//     res.json(
//       new ApiResponse(200, {
//         data,
//         total,
//         page: Number(page),
//         limit: Number(limit),
//       })
//     );
//   }),

//   getOne: asyncHandler(async (req, res) => {
//     const doc = await Model.findOne({
//       _id: req.params.id,
//       companyId: req.companyId,
//     });
//     if (!doc) throw new ApiError(404, "Record not found");
//     res.json(new ApiResponse(200, doc));
//   }),

//   create: asyncHandler(async (req, res) => {
//     const doc = await Model.create({ ...req.body, companyId: req.companyId });
//     res.status(201).json(new ApiResponse(201, doc, "Created successfully"));
//   }),

//   update: asyncHandler(async (req, res) => {
//     const doc = await Model.findOneAndUpdate(
//       { _id: req.params.id, companyId: req.companyId },
//       req.body,
//       { new: true, runValidators: true }
//     );
//     if (!doc) throw new ApiError(404, "Record not found");
//     res.json(new ApiResponse(200, doc, "Updated successfully"));
//   }),

//   //   remove: asyncHandler(async (req, res) => {
//   //     const doc = await Model.findOneAndUpdate(
//   //       { _id: req.params.id, companyId: req.companyId },
//   //       { isActive: false },
//   //       { new: true }
//   //     );
// const doc = await Model.findOneAndDelete({
//     _id: req.params.id,
//     companyId: req.companyId,
//   }).lean();
//   remove: asyncHandler(async (req, res) => {
//     const doc = await Model.findOneAndDelete({
//       _id: req.params.id,
//       companyId: req.companyId,
//     });
//     if (!doc) throw new ApiError(404, "Record not found");
//     res.json(new ApiResponse(200, null, "Deleted successfully"));
//   }),
// });

// export default crudFactory;

import asyncHandler from "./asyncHandler.js";
import ApiResponse from "./ApiResponse.js";
import ApiError from "./ApiError.js";
import { regexContains } from "./escapeRegex.js";
import { optionalSearchString } from "./sanitizeInput.js";

const ALLOWED_SORT_FIELDS = new Set(["createdAt", "updatedAt", "name", "code"]);

const crudFactory = (Model, options = {}) => {
  const {
    selectFields = "-__v",
    hasTextIndex = false,
    populateOpts = null,
  } = options;

  // ── Helper: apply populate (single or array) ────────────────
  const applyPopulate = (query) => {
    if (!populateOpts) return query;
    if (Array.isArray(populateOpts)) {
      populateOpts.forEach((opt) => {
        query = query.populate(opt);
      });
    } else {
      query = query.populate(populateOpts);
    }
    return query;
  };

  return {
    // ── GET ALL ───────────────────────────────────────────────
    getAll: asyncHandler(async (req, res) => {
      const {
        page = 1,
        limit = 20,
        search = "",
        isActive,
        sortBy = "createdAt",
        order = "desc",
      } = req.query;

      const filter = { companyId: req.companyId };

      if (isActive !== undefined) filter.isActive = isActive === "true";

      if (search) {
        const safeSearch = optionalSearchString(search);
        if (safeSearch) {
          if (hasTextIndex) {
            filter.$text = { $search: safeSearch };
          } else {
            filter.name = regexContains(safeSearch);
          }
        }
      }

      const skip = (Number(page) - 1) * Number(limit);
      const sortOrder = order === "asc" ? 1 : -1;
      const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "createdAt";

      let query = Model.find(filter)
        .select(selectFields)
        .sort({ [safeSortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .lean();

      query = applyPopulate(query);

      const [data, total] = await Promise.all([
        query,
        Model.countDocuments(filter),
      ]);

      res.json(
        new ApiResponse(200, {
          data,
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
          hasNext: Number(page) < Math.ceil(total / Number(limit)),
        })
      );
    }),

    // ── GET ONE ───────────────────────────────────────────────
    getOne: asyncHandler(async (req, res) => {
      let query = Model.findOne({
        _id: req.params.id,
        companyId: req.companyId,
      })
        .select(selectFields)
        .lean();

      query = applyPopulate(query);

      const doc = await query;
      if (!doc) throw new ApiError(404, "Record not found");
      res.json(new ApiResponse(200, doc));
    }),

    // ── CREATE ────────────────────────────────────────────────
    create: asyncHandler(async (req, res) => {
      delete req.body.companyId; // prevent client override
      const doc = await Model.create({
        ...req.body,
        companyId: req.companyId,
      });
      res.status(201).json(new ApiResponse(201, doc, "Created successfully"));
    }),

    // ── UPDATE ────────────────────────────────────────────────
    update: asyncHandler(async (req, res) => {
      delete req.body.companyId; // prevent client override
      const doc = await Model.findOneAndUpdate(
        { _id: req.params.id, companyId: req.companyId },
        { $set: req.body },
        { new: true, runValidators: true }
      )
        .select(selectFields)
        .lean();

      if (!doc) throw new ApiError(404, "Record not found");
      res.json(new ApiResponse(200, doc, "Updated successfully"));
    }),

    // ── SOFT DELETE ───────────────────────────────────────────
    remove: asyncHandler(async (req, res) => {
      // const doc = await Model.findOneAndUpdate(
      //   { _id: req.params.id, companyId: req.companyId },
      //   { $set: { isActive: false } },
      //   { new: true }
      // ).lean();
      const doc = await Model.findOneAndDelete({
        _id: req.params.id,
        companyId: req.companyId,
      }).lean();

      if (!doc) throw new ApiError(404, "Record not found");
      res.json(new ApiResponse(200, null, "Deleted successfully"));
    }),

    // ── RESTORE ───────────────────────────────────────────────
    restore: asyncHandler(async (req, res) => {
      const doc = await Model.findOneAndUpdate(
        { _id: req.params.id, companyId: req.companyId },
        { $set: { isActive: true } },
        { new: true }
      ).lean();

      if (!doc) throw new ApiError(404, "Record not found");
      res.json(new ApiResponse(200, doc, "Restored successfully"));
    }),
  };
};

export default crudFactory;
