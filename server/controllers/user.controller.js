import { User } from "../models/user.model.js";

export const createUserByManager = async (req, res, next) => {
  try {
    const { employeeId, name, email, password, role, country, branch, block, floor, gender } = req.body;

    if (!employeeId || !name || !email || !password) {
      return res.status(400).json({ message: "employeeId, name, email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedRole = role === "manager" ? "manager" : "employee";

    const user = await User.create({
      employeeId: String(employeeId).trim(),
      name: String(name).trim(),
      email: normalizedEmail,
      password: String(password),
      role: normalizedRole,
      gender,
      country: country || "",
      branch: branch || "",
      block: block || "",
      floor: floor || "",
    });

    return res.status(201).json({
      message: "User created successfully",
      user: { ...user.toObject(), password: undefined },
    });
  } catch (error) {
    if (error?.code === 11000) {
      const conflictField = Object.keys(error.keyPattern || {})[0] || "field";
      return res.status(409).json({ message: `${conflictField} already exists` });
    }
    return next(error);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const { role, isActive } = req.query;
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === "true";
    const users = await User.find(query)
      .select("_id name email employeeId role department designation phone isActive gender")
      .sort({ name: 1 })
      .lean();
    res.json(users);
  } catch (error) {
    next(error);
  }
};
