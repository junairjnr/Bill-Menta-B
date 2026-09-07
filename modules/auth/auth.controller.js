import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import authService from "./auth.service.js";

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res
    .status(201)
    .json(new ApiResponse(201, result, "Company registered successfully"));
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res
    .status(200)
    .json(new ApiResponse(200, result, "Login successful"));
});

export default { register, login };
