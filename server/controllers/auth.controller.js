import { User } from "../models/user.model.js";
import { signToken } from "../config/jwt.js";

export const register = async (req, res, next) => {
  try {
    const { employeeId, name, email, password, role, country, branch, block, floor, gender } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const fallbackName = normalizedEmail.split("@")[0] || "employee";
    const fallbackEmployeeId = `EMP-${Date.now().toString().slice(-6)}`;
    const user = await User.create({
      employeeId: employeeId || fallbackEmployeeId,
      name: name || fallbackName,
      email: normalizedEmail,
      password,
      role: role || "employee",
      gender,
      country,
      branch,
      block,
      floor
    });
    const token = signToken({ userId: user._id, role: user.role });
    res.status(201).json({ token, user: { ...user.toObject(), password: undefined } });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const identifier = String(email || "").trim();
    const normalizedEmail = identifier.toLowerCase();
    const user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { employeeId: { $regex: `^${identifier}$`, $options: "i" } },
      ],
    });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = signToken({ userId: user._id, role: user.role });
    return res.json({ token, user: { ...user.toObject(), password: undefined } });
  } catch (error) {
    return next(error);
  }
};

export const profile = async (req, res) => res.json(req.user);

export const logout = async (req, res) => res.json({ message: "Logged out" });
