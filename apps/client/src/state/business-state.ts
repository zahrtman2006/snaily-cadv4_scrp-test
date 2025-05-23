import {
  Business,
  BusinessPost,
  Citizen,
  Employee,
  EmployeeValue,
  RegisteredVehicle,
} from "@snailycad/types";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";

export type FullEmployee = Employee & {
  citizen: Pick<Citizen, "id" | "name" | "surname">;
  role: EmployeeValue;
};

export type FullBusiness = Business & {
  employees: Employee[];
  businessPosts: BusinessPost[];
  vehicles: RegisteredVehicle[];
  roles: EmployeeValue[];
};

interface BusinessState {
  currentBusiness: FullBusiness | null;
  setCurrentBusiness(bus: FullBusiness | null): void;

  currentEmployee: Employee | null;
  setCurrentEmployee(em: Employee | null): void;

  posts: BusinessPost[];
  setPosts(posts: BusinessPost[]): void;

  joinableBusinesses: Business[];
  setJoinableBusinesses(businesses: Business[]): void;
}

export const useBusinessState = createWithEqualityFn<BusinessState>()(
  (set) => ({
    currentBusiness: null,
    setCurrentBusiness: (business) => set({ currentBusiness: business }),

    currentEmployee: null,
    setCurrentEmployee: (employee) => set({ currentEmployee: employee }),

    posts: [],
    setPosts: (posts) => set({ posts }),

    joinableBusinesses: [],
    setJoinableBusinesses: (businesses) => set({ joinableBusinesses: businesses }),
  }),
  shallow,
);
