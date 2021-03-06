// Functions to convert to/from formatted currency strings and pence.

var toPence = function (currencyStr) {
    var regex = /^£?(\d+)(\.(\d\d))?$/;
    var match = regex.exec(currencyStr.replace(/,/g, ''));
    if (match) {
        var pence = parseInt(match[1]) * 100;
        if (match[3] != undefined) {
            // User has entered pence.
            pence += parseInt(match[3]);
        }
        return pence;
    }
    return null;
};

var toCurrencyStr = function (pence) {
    return "£" + (pence/100).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};


// Extender for formatted currency input/output.

ko.extenders.currency = function (target) {

    // Attach a new computed observable, allowing for formatted input/output.
    target.formatted = ko.computed({
        read: function () {
            if (target() == null) {
                return null;
            }
            return toCurrencyStr(target());
        },
        write: function (currencyStr) {
            target(0);
            target(toPence(currencyStr));
        }
    }); 
    return target;
};


// Binding for formatted currency output.

ko.bindingHandlers.currency = {
    update: function(element, valueAccessor, allBindingsAccessor) {
        return ko.bindingHandlers.text.update(element,function() {
            var pence = +(ko.utils.unwrapObservable(valueAccessor()) || 0);
            return toCurrencyStr(pence);
        });
    }
};


// Model class for a single monthly expense.

function MonthlyExpense(initialName, initialCost) {
    this.name = ko.observable(initialName);
    this.cost = ko.observable(initialCost).extend({currency: {}});
}


// View model.

function ViewModel() {
    var self = this;

    self.grossSalary = ko.observable(store.get("grossSalary")).extend({currency: {}});
    self.calcEnabled = ko.computed(function() {
        return (self.grossSalary() != null);
    }, self);

    self.incomeTax = ko.computed(function() {
        var personalAllowance = Math.max(0, 1100000 - Math.max(self.grossSalary() - 10000000, 0)*50);
        var taxableIncome = Math.max(self.grossSalary() - personalAllowance, 0);
        if (taxableIncome <= 3200000) {
            // 20% band.
            return taxableIncome*0.2;
        }
        else if (taxableIncome <= 15000000) {
            // 40% band.
            return (taxableIncome - 3200000)*0.4 + 640000;
        } else {
            // 45% band.
            return (taxableIncome - 15000000)*0.45 + 5364000;
        }
    }, self);

    self.nationalInsurance = ko.computed(function() {
        var primaryThreshold = 806000;
        var upperThreshold = 4300400;
        if (self.grossSalary() < primaryThreshold) {
            return 0;
        } else if (self.grossSalary() < upperThreshold) {
            // 12% band
            return (self.grossSalary() - primaryThreshold)*0.12;
        } else {
            // 2% band
            return (upperThreshold - primaryThreshold)*0.12 + (self.grossSalary() - upperThreshold)*0.02;
        }
    }, self);

    self.studentLoanOption = ko.observable(store.get("studentLoanOption") != null ? store.get("studentLoanOption") : 1);
    self.updateStudentLoanOption = function(option) {
        if (self.calcEnabled()) {
            self.studentLoanOption(option);
        }
    }
    self.studentLoan = ko.computed(function() {
        if (self.studentLoanOption() == 2) {
            return 0;
        } 
        var cutoff = self.studentLoanOption() == 0 ? 1733500 : 2100000;
        return Math.min(Math.max(self.grossSalary() - cutoff, 0)*0.09, 6000000); 
    }, self);

    self.netIncome = ko.computed(function() {
        return self.grossSalary() - self.incomeTax() - self.nationalInsurance() - self.studentLoan();
    }, self);

    self.netMonthlyIncome = ko.computed(function() {
        return self.netIncome() / 12;
    }, self);

    self.monthlyExpenses = ko.observableArray([
        new MonthlyExpense("", null)
    ]);
    self.totalMonthlyExpenses = ko.computed(function() {
        var total = 0;
        for (var i = 0; i < self.monthlyExpenses().length; i++) {
            var monthlyCost = self.monthlyExpenses()[i].cost();
            if (monthlyCost != null) {
                total += self.monthlyExpenses()[i].cost();
            }
        }
        return total;
    }, self);

    self.monthlyRemaining = ko.computed(function() {
        return self.netMonthlyIncome() - self.totalMonthlyExpenses();
    }, self);

    self.addExpense = function() {
        if (self.calcEnabled()) {
            self.monthlyExpenses.push(new MonthlyExpense("", null));
        }
    };
    self.removeExpense = function(expense) {
        if (self.calcEnabled()) {
            if (self.monthlyExpenses().length == 1) {
                self.monthlyExpenses()[0].name("");
                self.monthlyExpenses()[0].cost(null);
            } else {
                self.monthlyExpenses.remove(expense);
            }
        }
    };
}

var viewModel = new ViewModel();
ko.applyBindings(viewModel);

var saveState = function() {
    // Save currenct state using store.js.
    store.set("grossSalary", viewModel.grossSalary());
    store.set("studentLoanOption", viewModel.studentLoanOption());
    store.set("expenses", ko.toJSON(viewModel.monthlyExpenses()));
}

window.onpagehide = saveState;

var loadState = function() {
    if (store.get("grossSalary") != null) {
        // Activate green line under salary input if we have a saved salary.
        $("#gross-salary-input").addClass("valid");
    }

    // Update monthly expenses from store (salary/student loan option done directly).
    var savedMonthlyExpenses = JSON.parse(store.get("expenses"));
    if (savedMonthlyExpenses != null && savedMonthlyExpenses.length > 0) {
        // Remove current empty entry first.
        viewModel.monthlyExpenses.pop();

        // Remove all trailing empty entries.
        while (savedMonthlyExpenses.length > 0) {
            var lastExpense = savedMonthlyExpenses[savedMonthlyExpenses.length - 1];
            if (lastExpense["name"] == "" && lastExpense["cost"] == null) {
                savedMonthlyExpenses.pop();
            } else {
                break;
            }
        }

        // Convert to observable MonthlyExpense instances, popular monthly expenses array.
        for (var i = 0; i < savedMonthlyExpenses.length; i++) {
            var savedExpense = savedMonthlyExpenses[i];
            viewModel.monthlyExpenses.push(new MonthlyExpense(savedExpense["name"], savedExpense["cost"]));
        }

        // Add in a blank expense if it turns out that we didn't add any.
        if (viewModel.monthlyExpenses().length == 0) {
            viewModel.monthlyExpenses.push(new MonthlyExpense("", null));
        }
    }
}

window.onpageshow = loadState;
